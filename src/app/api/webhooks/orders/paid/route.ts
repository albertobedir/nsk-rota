import { NextRequest, NextResponse } from "next/server";
import { maybeRestoreCreditWhenPaid } from "@/lib/shopify/customer-credit";
import {
  applyShopifyOrderUpdate,
  verifyShopifyWebhook,
} from "@/lib/shopify/order-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  console.log("[orders/paid] request received", {
    topic: req.headers.get("x-shopify-topic"),
  });

  try {
    const rawBody = await req.text();

    const verified = verifyShopifyWebhook(req, rawBody);
    if (!verified) {
      console.warn("[orders/paid] HMAC verification failed");
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const orderData = JSON.parse(rawBody);

    const shopifyIdHint = orderData.admin_graphql_api_id
      ? String(orderData.admin_graphql_api_id).split("?")[0]
      : `gid://shopify/Order/${orderData.id}`;

    console.log("📦 orders/paid webhook:", shopifyIdHint);

    const {
      shopifyId,
      result,
      cancelledAt,
      financialStatus,
      fulfillmentStatus,
      previousFinancialStatus,
    } = await applyShopifyOrderUpdate(orderData, { upsert: false });

    if (!result) {
      console.warn("⚠️ Order not found in DB before credit restore:", shopifyId);
    } else {
      console.log("✅ Order paid:", shopifyId, {
        fulfillmentStatus,
        financialStatus,
        cancelledAt,
      });
    }

    const creditRestore = await maybeRestoreCreditWhenPaid({
      shopifyId,
      orderData,
      previousFinancialStatus,
    });

    console.log("[orders/paid] credit restore result:", shopifyId, creditRestore);

    return NextResponse.json({ status: "ok", shopifyId, creditRestore });
  } catch (err) {
    console.error("orders/paid webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
