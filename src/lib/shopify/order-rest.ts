/* eslint-disable @typescript-eslint/no-explicit-any */
import { extractNumericId } from "@/lib/shopify/ids";

const ADMIN_API_VERSION = "2024-10";

function adminOrdersUrl(pathAndQuery: string) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("Missing SHOPIFY_STORE_DOMAIN");
  return `https://${domain}/admin/api/${ADMIN_API_VERSION}${pathAndQuery}`;
}

function adminHeaders() {
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN");
  return { "X-Shopify-Access-Token": token };
}

async function shopifyRestGet(pathAndQuery: string) {
  const response = await fetch(adminOrdersUrl(pathAndQuery), {
    headers: adminHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Shopify REST ${pathAndQuery} failed: ${response.status} ${text}`.trim(),
    );
  }
  return response.json();
}

export function numericShopifyOrderId(value?: unknown): string | null {
  return extractNumericId(
    typeof value === "number" || typeof value === "string" ? value : null,
  );
}

export async function fetchShopifyRestOrder(
  orderId?: string | number | null,
): Promise<any | null> {
  const numericId = numericShopifyOrderId(orderId);
  if (!numericId) return null;

  const data = await shopifyRestGet(`/orders/${numericId}.json`);
  return data?.order ?? null;
}

export async function fetchShopifyRestOrdersByIds(
  orderIds: Array<string | number | null | undefined>,
): Promise<any[]> {
  const uniqueIds = [
    ...new Set(
      orderIds
        .map((id) => numericShopifyOrderId(id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (uniqueIds.length === 0) return [];

  const orders: any[] = [];
  const chunkSize = 50;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const data = await shopifyRestGet(
      `/orders.json?ids=${chunk.join(",")}&status=any&limit=${chunk.length}`,
    );
    if (Array.isArray(data?.orders)) orders.push(...data.orders);
  }
  return orders;
}
