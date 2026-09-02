export function extractNumericId(
  value?: string | number | null,
): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const match = s.match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

export function toShopifyGid(
  resource:
    | "Customer"
    | "Order"
    | "Product"
    | "Variant"
    | "Company"
    | "CompanyLocation"
    | "CompanyContact",
  value?: string | number | null,
): string | null {
  if (value == null) return null;
  const raw = String(value).trim().split("?")[0];
  if (!raw) return null;
  if (raw.startsWith(`gid://shopify/${resource}/`)) return raw;
  const numeric = extractNumericId(raw);
  return numeric ? `gid://shopify/${resource}/${numeric}` : null;
}

export function toCustomerGid(value?: string | number | null): string | null {
  return toShopifyGid("Customer", value);
}

export function toOrderGid(value?: string | number | null): string | null {
  return toShopifyGid("Order", value);
}
