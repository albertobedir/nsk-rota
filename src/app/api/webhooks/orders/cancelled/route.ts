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
    const { shopifyId, result } = await applyShopifyOrderUpdate(orderData, {
      upsert: true,
    });

    if (!result) {
      console.warn("⚠️ Cancelled order could not be saved:", shopifyId);
    } else {
      console.log("✅ Order cancelled and saved:", shopifyId, {
        cancelledAt: orderData.cancelled_at,
        cancelReason: orderData.cancel_reason,
        financialStatus: orderData.financial_status,
      });
    }

    return NextResponse.json({ status: "ok", shopifyId, cancelled: true });
  } catch (err) {
    console.error("orders/cancelled webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
