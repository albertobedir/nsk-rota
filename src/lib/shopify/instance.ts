const domain = process.env.SHOPIFY_STORE_DOMAIN;
const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const adminAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

interface ShopifyFetchParams<TVariables = Record<string, unknown>> {
  query: string;
  variables?: TVariables;
}

export async function shopifyFetch<TVariables>({
  query,
  variables,
}: ShopifyFetchParams<TVariables>) {
  const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontAccessToken!,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error("Shopify API request failed");
  }

  return response.json();
}

export async function shopifyAdminFetch<TVariables>({
  query,
  variables,
}: ShopifyFetchParams<TVariables>) {
  if (!adminAccessToken) {
    throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN");
  }

  const response = await fetch(
    `https://${domain}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Shopify Admin API error:", response.status, text);
    throw new Error("Shopify Admin API request failed");
  }

  const json = await response.json();
  console.log("shopifyAdminFetch raw json:", JSON.stringify(json, null, 2));
  return json;
}
