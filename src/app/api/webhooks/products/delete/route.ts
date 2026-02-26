import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const productData = JSON.parse(rawBody);
    console.log("Product deleted - ID:", productData.id);

    await connectDB();

    const result = await Product.deleteOne({ shopifyId: productData.id });

    console.log("Product deleted from DB:", result.deletedCount);

    return NextResponse.json(
      { status: "ok", action: "deleted", productId: productData.id },
      { status: 200 },
    );
  } catch (err) {
    console.error("Webhook delete error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

//*
