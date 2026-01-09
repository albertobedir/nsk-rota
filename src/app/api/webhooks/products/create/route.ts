import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
import { clear } from "console";
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

async function fetchProductMetafields(productId: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        metafields(first: 100) {
          edges {
            node {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken!,
      },
      body: JSON.stringify({ query, variables: { id: productId } }),
    }
  );

  const data = await response.json();

  // Hata kontrolü ekle
  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    return [];
  }

  if (!data.data?.product?.metafields?.edges) {
    console.warn("No metafields found for product:", productId);
    return [];
  }

  return data.data.product.metafields.edges.map(
    (edge: { node: Record<string, unknown> }) => edge.node
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log("Webhook raw body:", rawBody);
    try {
      console.log(
        "Webhook headers:",
        Object.fromEntries(req.headers.entries())
      );
    } catch (hdrErr) {
      console.warn("Could not stringify headers:", hdrErr);
    }
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const productData = JSON.parse(rawBody);
    try {
      console.log("Parsed webhook JSON:", JSON.stringify(productData, null, 2));
    } catch (jsonErr) {
      console.warn("Could not pretty-print parsed JSON:", jsonErr);
    }
    console.log("Product ID:", productData.id);

    // Metafields fetch'i try-catch içine al
    let metafields = [];
    try {
      metafields = await fetchProductMetafields(
        productData.admin_graphql_api_id
      );
      console.log("Metafields fetched:", metafields.length);
    } catch (metaErr) {
      console.error("Metafield fetch error:", metaErr);
      // Metafield hatası olsa bile ürünü kaydet
    }

    const fullProduct = {
      ...productData,
      metafields,
      receivedAt: new Date(),
    };

    await connectDB();

    await Product.updateOne(
      { shopifyId: productData.id },
      { $set: { raw: fullProduct } },
      { upsert: true }
    );

    return NextResponse.json(
      { status: "ok", productId: productData.id },
      { status: 200 }
    );
  } catch (err) {
    console.error("Webhook error:", err); // Bu satırı ekle
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
