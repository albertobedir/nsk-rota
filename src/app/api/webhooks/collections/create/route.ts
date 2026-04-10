/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Collection from "@/schemas/mongoose/collection";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyWebhook(req: NextRequest, rawBody: string) {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

async function fetchCollectionProducts(collectionGid: string): Promise<any[]> {
  const query = `
    query getCollectionProducts($id: ID!, $cursor: String) {
      collection(id: $id) {
        products(first: 250, after: $cursor) {
          edges {
            node {
              id
              legacyResourceId
              title
              handle
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const allProducts: any[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: Response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
        },
        body: JSON.stringify({
          query,
          variables: { id: collectionGid, cursor },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText}`,
      );
    }

    const { data, errors }: any = await response.json();

    if (errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
    }

    const productsPage: any = data?.collection?.products;
    if (!productsPage) break;

    const batch = productsPage.edges.map((edge: any) => ({
      id: parseInt(edge.node.legacyResourceId),
      title: edge.node.title,
      handle: edge.node.handle,
      gid: edge.node.id,
    }));

    allProducts.push(...batch);
    hasNextPage = productsPage.pageInfo.hasNextPage;
    cursor = productsPage.pageInfo.endCursor ?? null;

    console.log(
      `[Collection Sync] Fetched ${allProducts.length} products so far...`,
    );
  }

  return allProducts;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const collectionData = JSON.parse(rawBody);
    console.log("[Collection Webhook] Received - ID:", collectionData.id);

    await connectDB();

    // 1. Collection meta verisini kaydet
    const full = {
      ...collectionData,
      receivedAt: new Date(),
    };

    await Collection.updateOne(
      { shopifyId: collectionData.id },
      { $set: { raw: full, updatedAt: new Date() } },
      { upsert: true },
    );

    // 2. Tüm ürünleri sayfalama ile Shopify'dan çek
    const products = await fetchCollectionProducts(
      collectionData.admin_graphql_api_id,
    );

    // 3. Ürünleri MongoDB'ye kaydet
    await Collection.updateOne(
      { shopifyId: collectionData.id },
      {
        $set: {
          products,
          productCount: products.length,
          updatedAt: new Date(),
        },
      },
    );

    console.log(
      `[Collection Webhook] Collection ${collectionData.id} saved with ${products.length} products`,
    );

    return NextResponse.json(
      {
        status: "ok",
        collectionId: collectionData.id,
        productCount: products.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[Collection Webhook] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
