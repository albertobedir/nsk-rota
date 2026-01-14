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

async function fetchCollectionProducts(collectionGid: string) {
  const query = `
    query getCollectionProducts($id: ID!) {
      collection(id: $id) {
        products(first: 250) {
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
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query,
        variables: { id: collectionGid },
      }),
    }
  );

  const { data } = await response.json();

  return (
    data?.collection?.products?.edges?.map((edge: any) => ({
      id: parseInt(edge.node.legacyResourceId),
      title: edge.node.title,
      handle: edge.node.handle,
      gid: edge.node.id,
    })) || []
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const collectionData = JSON.parse(rawBody);
    console.log("Collection updated - ID:", collectionData.id);

    await connectDB();

    // 1. Collection meta verilerini kaydet
    const full = {
      ...collectionData,
      receivedAt: new Date(),
    };

    await Collection.updateOne(
      { shopifyId: collectionData.id },
      { $set: { raw: full, updatedAt: new Date() } },
      { upsert: true }
    );

    // 2. Güncel ürünleri Shopify'dan çek
    const products = await fetchCollectionProducts(
      collectionData.admin_graphql_api_id
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
      }
    );

    console.log(
      `Collection ${collectionData.id} updated with ${products.length} products`
    );

    return NextResponse.json(
      {
        status: "ok",
        action: "updated",
        collectionId: collectionData.id,
        productCount: products.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Collection webhook update error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
