import { NextRequest, NextResponse } from "next/server";
import {
  applyShopifyFulfillmentUpdate,
  verifyShopifyWebhook,
} from "@/lib/shopify/order-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);
    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const fulfillment = JSON.parse(rawBody);
    console.log("📦 fulfillments/create webhook:", fulfillment?.id, fulfillment?.order_id);

    const result = await applyShopifyFulfillmentUpdate(fulfillment);
    return NextResponse.json({
      status: "ok",
      shopifyId: result.shopifyId,
      skipped: result.skipped,
      fulfillmentStatus: result.fulfillmentStatus,
    });
  } catch (err) {
    console.error("fulfillments/create webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
