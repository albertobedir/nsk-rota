const domain = process.env.SHOPIFY_STORE_DOMAIN;
const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

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
