/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import { extractNumericId } from "@/lib/shopify/ids";
import { fetchShopifyRestOrder } from "@/lib/shopify/order-rest";

export function verifyShopifyWebhook(req: NextRequest, rawBody: string) {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function resolveShopifyId(orderData: any): string {
  return orderData.admin_graphql_api_id
    ? String(orderData.admin_graphql_api_id).split("?")[0]
    : `gid://shopify/Order/${orderData.id}`;
}

function stripNulls(obj: Record<string, any> | null | undefined) {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  );
}

export function resolveOrderPoNumber(orderData: any): string | null {
  const value = orderData?.po_number ?? orderData?.poNumber ?? null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cachedOrderLookupFilter(orderData: any, shopifyId: string) {
  const numericId =
    orderData?.id != null
      ? String(orderData.id)
      : extractNumericId(shopifyId);
  const orderNumber = orderData?.order_number
    ? Number(orderData.order_number)
    : undefined;

  return {
    $or: [
      { shopifyId },
      ...(numericId
        ? [
            { shopifyId: numericId },
            { shopifyId: `gid://shopify/Order/${numericId}` },
            { "raw.id": Number(numericId) },
            { "raw.id": numericId },
          ]
        : []),
      ...(orderNumber && !Number.isNaN(orderNumber)
        ? [{ orderNumber }]
        : []),
    ],
  };
}

export async function applyShopifyOrderUpdate(
  orderData: any,
  { upsert }: { upsert: boolean },
) {
  await connectDB();

  const shopifyId = resolveShopifyId(orderData);
  const existing = await Order.findOne(
    cachedOrderLookupFilter(orderData, shopifyId),
  ).lean();
  const previousFinancialStatus =
    existing?.financialStatus ??
    (typeof existing?.raw?.financial_status === "string"
      ? existing.raw.financial_status
      : null);
  const fulfillments: any[] = orderData.fulfillments ?? [];
  const latestFulfillment = fulfillments[fulfillments.length - 1];

  const trackingNumber = latestFulfillment?.tracking_number ?? undefined;
  const trackingUrl = latestFulfillment?.tracking_url ?? undefined;
  const trackingCompany = latestFulfillment?.tracking_company ?? undefined;
  const fulfillmentStatus = orderData.fulfillment_status ?? "unfulfilled";
  const financialStatus = orderData.financial_status ?? undefined;
  const cancelledAt = orderData.cancelled_at
    ? new Date(orderData.cancelled_at)
    : null;
  const cancelReason = orderData.cancel_reason ?? null;

  const customerGid = orderData.customer?.id
    ? `gid://shopify/Customer/${orderData.customer.id}`
    : undefined;

  const orderNumber = orderData.order_number
    ? Number(orderData.order_number)
    : orderData.name
      ? Number(String(orderData.name).replace(/^#/, ""))
      : undefined;

  const poNumber = resolveOrderPoNumber(orderData);

  const set: Record<string, any> = {
    raw: existing?.raw
      ? { ...existing.raw, ...orderData }
      : orderData,
    cancelledAt,
    cancelReason,
    fulfillmentStatus,
    ...(poNumber && { poNumber }),
    ...(trackingNumber && { trackingNumber }),
    ...(trackingUrl && { trackingUrl }),
    ...(trackingCompany && { trackingCompany }),
    ...(financialStatus && { financialStatus }),
  };

  if (upsert) {
    set.shopifyId = shopifyId;
    if (orderNumber && !Number.isNaN(orderNumber)) set.orderNumber = orderNumber;
    if (orderData.name) set.name = orderData.name;
    if (customerGid) set.customerId = customerGid;

    const billingAddress = stripNulls(orderData.billing_address);
    const shippingAddress = stripNulls(orderData.shipping_address);
    if (billingAddress) set.billingAddress = billingAddress;
    if (shippingAddress) set.shippingAddress = shippingAddress;
  }

  const result = await Order.findOneAndUpdate(
    existing?._id ? { _id: existing._id } : { shopifyId },
    { $set: set },
    { upsert, new: true },
  ).lean();

  return {
    shopifyId,
    result,
    cancelledAt,
    financialStatus,
    fulfillmentStatus,
    previousFinancialStatus,
    skipped: undefined as string | undefined,
  };
}

export async function syncShopifyOrderById(orderId?: string | number | null) {
  const live = await fetchShopifyRestOrder(orderId);
  if (!live) {
    return {
      shopifyId: undefined as string | undefined,
      result: null,
      skipped: "not_found_in_shopify" as const,
      fulfillmentStatus: undefined as string | undefined,
    };
  }
  return applyShopifyOrderUpdate(live, { upsert: false });
}

export async function applyShopifyFulfillmentUpdate(fulfillmentData: any) {
  const orderId = fulfillmentData?.order_id;
  if (!orderId) {
    return {
      shopifyId: undefined as string | undefined,
      result: null,
      skipped: "missing_order_id" as const,
      fulfillmentStatus: undefined as string | undefined,
    };
  }
  return syncShopifyOrderById(orderId);
}

export function isShopifyFulfillmentPayload(data: any): boolean {
  const gid = String(data?.admin_graphql_api_id || "");
  if (gid.includes("/Fulfillment/")) return true;
  if (data?.kind === "fulfillment") return true;
  return Boolean(
    data?.order_id &&
      !data?.order_number &&
      !data?.financial_status &&
      !data?.admin_graphql_api_id?.includes("/Order/"),
  );
}
