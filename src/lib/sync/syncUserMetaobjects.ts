import { shopifyAdminFetch } from "@/lib/shopify/instance";
import prisma from "@/lib/prisma/instance";

interface SyncOptions {
  customerId?: string;
  productIds?: string[];
}

export async function syncUserMetaobjects({
  customerId,
  productIds,
}: SyncOptions) {
  if (!customerId) return { success: false, message: "No customer ID" };

  try {
    const GQL = `
      query GetCustomerPricing($query: String!, $first: Int!) {
        metaobjects(
          type: "customer_pricing"
          first: $first
          query: $query
        ) {
          edges {
            node {
              id
              handle
              updatedAt
              fields {
                key
                value
                reference {
                  ... on Customer { id email }
                  ... on Product { id title }
                }
              }
            }
          }
        }
      }
    `;

    const queryString = `customer:${customerId}`;

    const response = await shopifyAdminFetch({
      query: GQL,
      variables: { query: queryString, first: 50 },
    });

    const metaobjects =
      response?.data?.metaobjects?.edges?.map((edge: any) => edge.node) || [];

    let upserted = 0;

    for (const metaobject of metaobjects) {
      const fields: Array<any> = metaobject.fields ?? [];

      const priceField = fields.find((f) => f.key === "price");
      const customerField = fields.find((f) => f.key === "customer");

      const priceVal =
        priceField?.value != null ? parseFloat(priceField.value) : 0;
      const customerRef = customerField?.reference;

      await prisma.customerPricing.upsert({
        where: { metaobjectId: metaobject.id },
        update: {
          customerId: customerRef?.id ?? customerId,
          price: priceVal,
          updatedAt: metaobject.updatedAt
            ? new Date(metaobject.updatedAt)
            : undefined,
        },
        create: {
          metaobjectId: metaobject.id,
          customerId: customerRef?.id ?? customerId,
          price: priceVal,
        },
      });

      upserted++;
    }

    return { success: true, count: metaobjects.length, upserted };
  } catch (error) {
    console.error("User metaobject sync failed:", error);
    return { success: false, error };
  }
}

export default syncUserMetaobjects;
