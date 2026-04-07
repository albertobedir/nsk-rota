/**
 * Utility to fetch Shopify customer ID by email
 */
export async function getShopifyCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`,
      {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
        },
      },
    );
    const json = await res.json();
    const customer = json?.customers?.[0];
    if (!customer) return null;
    return `gid://shopify/Customer/${customer.id}`;
  } catch (error) {
    console.warn("[shopify-customer] Failed to fetch customer ID:", error);
    return null;
  }
}
