import { NextRequest, NextResponse } from "next/server";
import {
  applyShopifyOrderUpdate,
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

    const orderData = JSON.parse(rawBody);

    const shopifyIdHint = orderData.admin_graphql_api_id
      ? String(orderData.admin_graphql_api_id).split("?")[0]
      : `gid://shopify/Order/${orderData.id}`;

    console.log("📦 orders/updated webhook:", shopifyIdHint);

    const { shopifyId, result, cancelledAt, financialStatus, fulfillmentStatus } =
      await applyShopifyOrderUpdate(orderData, { upsert: false });

    if (!result) {
      console.warn("⚠️ Order not found in DB:", shopifyId);
    } else {
      console.log("✅ Order updated:", shopifyId, {
        fulfillmentStatus,
        financialStatus,
        cancelledAt,
      });
    }

    return NextResponse.json({ status: "ok", shopifyId });
  } catch (err) {
    console.error("orders/updated webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
