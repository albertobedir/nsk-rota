/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";

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

    const orderData = JSON.parse(rawBody);

    const shopifyId = orderData.admin_graphql_api_id
      ? String(orderData.admin_graphql_api_id).split("?")[0]
      : `gid://shopify/Order/${orderData.id}`;

    console.log("📦 orders/update webhook:", shopifyId);

    // Fulfillment'lardan tracking bilgisini çıkar
    const fulfillments: any[] = orderData.fulfillments ?? [];
    const latestFulfillment = fulfillments[fulfillments.length - 1];

    const trackingNumber = latestFulfillment?.tracking_number ?? undefined;
    const trackingUrl = latestFulfillment?.tracking_url ?? undefined;
    const trackingCompany = latestFulfillment?.tracking_company ?? undefined;
    const fulfillmentStatus = orderData.fulfillment_status ?? undefined;
    const financialStatus = orderData.financial_status ?? undefined;

    await connectDB();

    // Sadece mevcut order'ı güncelle, yeni doküman AÇMA
    const result = await Order.findOneAndUpdate(
      { shopifyId },
      {
        $set: {
          ...(trackingNumber && { trackingNumber }),
          ...(trackingUrl && { trackingUrl }),
          ...(trackingCompany && { trackingCompany }),
          ...(fulfillmentStatus && { fulfillmentStatus }),
          ...(financialStatus && { financialStatus }),
          // raw'ı da güncelle
          raw: orderData,
        },
      },
      { upsert: false, new: true }, // ✅ upsert: false — yeni doküman açılmaz
    );

    if (!result) {
      console.warn("⚠️ Order not found in DB:", shopifyId);
    } else {
      console.log("✅ Order updated:", shopifyId, {
        trackingNumber,
        fulfillmentStatus,
      });
    }

    return NextResponse.json({ status: "ok", shopifyId });
  } catch (err) {
    console.error("orders/update webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
