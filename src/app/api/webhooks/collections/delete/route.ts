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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const collectionData = JSON.parse(rawBody);
    console.log("Collection deleted - ID:", collectionData.id);

    await connectDB();

    // Hard delete - kaydı tamamen sil
    const result = await Collection.deleteOne({
      shopifyId: collectionData.id,
    });

    console.log(`Collection ${collectionData.id} permanently deleted`);

    return NextResponse.json(
      {
        status: "ok",
        action: "hard_deleted",
        collectionId: collectionData.id,
        deleted: result.deletedCount > 0,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Collection webhook delete error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
