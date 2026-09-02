/* eslint-disable @typescript-eslint/no-explicit-any */
import { extractNumericId } from "@/lib/shopify/ids";

function moneyAmount(value: any): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return "";
}

function mapGqlEdge(e: any, fallbackCurrency = "USD") {
  const node = e?.node || e || {};
  const originalPrice = moneyAmount(
    node.originalUnitPriceSet?.shopMoney?.amount ??
      node.originalUnitPrice ??
      node.variant?.price?.amount ??
      node.price,
  );
  const discountedPrice = moneyAmount(
    node.discountedUnitPriceSet?.shopMoney?.amount ??
      node.discountedUnitPrice ??
      originalPrice,
  );
  const currencyCode =
    node.originalUnitPriceSet?.shopMoney?.currencyCode ||
    node.variant?.price?.currencyCode ||
    fallbackCurrency;
  const productId =
    extractNumericId(
      node.productId ??
        node.product_id ??
        node.product?.id ??
        node.variant?.product?.id,
    ) || null;
  const imageUrl =
    node.variant?.image?.url ||
    node.image?.url ||
    node.image?.src ||
    node.variant?.image?.src ||
    null;

  return {
    node: {
      ...node,
      title: node.title || node.name,
      quantity: node.quantity ?? 1,
      sku: node.sku || node.variant?.sku || node.variant_title || "",
      productId,
      originalUnitPrice: originalPrice,
      discountedUnitPrice: discountedPrice,
      discountDescription:
        node.discountAllocations?.[0]?.discountApplication?.description ||
        node.discountAllocations?.[0]?.discountApplication?.title ||
        node.discountDescription ||
        null,
      variant: {
        ...node.variant,
        image: { url: imageUrl },
        price: {
          amount: String(originalPrice),
          currencyCode,
        },
      },
    },
  };
}

function mapRestItem(li: any, raw: any) {
  const qty = Number(li.quantity ?? 1) || 1;
  const originalPrice = moneyAmount(
    li.originalUnitPriceSet?.shopMoney?.amount ?? li.price,
  );
  const totalDiscount = moneyAmount(li.total_discount);
  const discountedFromRest =
    qty > 0 && totalDiscount > 0
      ? (originalPrice * qty - totalDiscount) / qty
      : moneyAmount(
          li.discountedUnitPriceSet?.shopMoney?.amount ?? originalPrice,
        );
  const currencyCode =
    li.originalUnitPriceSet?.shopMoney?.currencyCode ||
    raw?.currency ||
    "USD";
  const discountApplications: any[] = raw?.discount_applications || [];
  const allocation = li.discount_allocations?.[0];
  const appIndex = allocation?.discount_application_index ?? null;
  const discountApp =
    appIndex != null ? discountApplications[appIndex] : null;

  return {
    node: {
      title: li.title || li.name,
      quantity: qty,
      sku: li.sku || li.variant_title || li.variant?.sku || "",
      productId:
        extractNumericId(
          li.product_id ?? li.productId ?? li.product?.id ?? li.variant?.product?.id,
        ) || null,
      originalUnitPrice: originalPrice,
      discountedUnitPrice: discountedFromRest,
      discountDescription:
        li.discountAllocations?.[0]?.discountApplication?.description ||
        li.discountAllocations?.[0]?.discountApplication?.title ||
        discountApp?.description ||
        discountApp?.title ||
        null,
      variant: {
        image: {
          url:
            li.variant?.image?.url ||
            li.image?.src ||
            li.image?.url ||
            li.featured_image?.src ||
            null,
        },
        price: {
          amount: String(originalPrice),
          currencyCode,
        },
      },
    },
  };
}

export function normalizeLineItemEdges(order: any): any[] {
  const src = order || {};
  const raw = src.raw || {};

  const gqlEdges = [src.lineItems?.edges, raw.lineItems?.edges].find(
    (edges) => Array.isArray(edges) && edges.length > 0,
  );
  if (gqlEdges) {
    const currency =
      raw.currency ||
      src.totalPriceSet?.shopMoney?.currencyCode ||
      "USD";
    return gqlEdges.map((e: any) => mapGqlEdge(e, currency));
  }

  const restItems = [raw.line_items, raw.lineItems, src.line_items].find(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );
  if (restItems) {
    return restItems.map((li: any) => mapRestItem(li, raw));
  }

  return [];
}

export function formatOrderMoney(order: any): { amount: string; currency: string } {
  const amount = firstNonEmpty(
    order?.raw?.total_price,
    order?.raw?.current_total_price,
    order?.raw?.totalPriceSet?.shopMoney?.amount,
    order?.totalPriceSet?.shopMoney?.amount,
    order?.totalPrice?.amount,
    order?.grandTotal,
  );
  const currency = firstNonEmpty(
    order?.raw?.currency,
    order?.raw?.presentment_currency,
    order?.raw?.totalPriceSet?.shopMoney?.currencyCode,
    order?.totalPriceSet?.shopMoney?.currencyCode,
    order?.totalPrice?.currencyCode,
    order?.currency,
    "USD",
  );
  return { amount, currency };
}

export function formatOrderTotal(order: any): string {
  const { amount, currency } = formatOrderMoney(order);
  return amount ? `${amount} ${currency}` : "";
}
