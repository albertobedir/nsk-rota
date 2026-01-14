/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
      query GetCustomerPricingAndTiers($query: String!, $first: Int!) {
        customerPricing: metaobjects(
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
        
        pricingTiers: metaobjects(
          type: "pricing_tier"
          first: 10
        ) {
          edges {
            node {
              id
              handle
              updatedAt
              fields {
                key
                value
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

    const customerPricingMetaobjects =
      response?.data?.customerPricing?.edges?.map((edge: any) => edge.node) ||
      [];

    const pricingTierMetaobjects =
      response?.data?.pricingTiers?.edges?.map((edge: any) => edge.node) || [];

    let upserted = 0;
    let tiersUpserted = 0;

    // Customer Pricing Sync
    for (const metaobject of customerPricingMetaobjects) {
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

    // Pricing Tier Sync
    for (const metaobject of pricingTierMetaobjects) {
      const fields: Array<any> = metaobject.fields ?? [];

      const tierNameField = fields.find((f) => f.key === "tier_name");
      const tierTagField = fields.find((f) => f.key === "tier_tag");
      const discountPercentageField = fields.find(
        (f) => f.key === "discount_percentage"
      );

      const tierName = tierNameField?.value ?? "";
      const tierTag = tierTagField?.value ?? "";
      const discountPercentage =
        discountPercentageField?.value != null
          ? parseFloat(discountPercentageField.value)
          : 0;

      await prisma.pricingTier.upsert({
        where: { metaobjectId: metaobject.id },
        update: {
          tierName,
          tierTag,
          discountPercentage,
          updatedAt: metaobject.updatedAt
            ? new Date(metaobject.updatedAt)
            : undefined,
        },
        create: {
          metaobjectId: metaobject.id,
          tierName,
          tierTag,
          discountPercentage,
        },
      });

      tiersUpserted++;
    }

    return {
      success: true,
      customerPricing: { count: customerPricingMetaobjects.length, upserted },
      pricingTiers: {
        count: pricingTierMetaobjects.length,
        upserted: tiersUpserted,
      },
    };
  } catch (error) {
    console.error("User metaobject sync failed:", error);
    return { success: false, error };
  }
}

export default syncUserMetaobjects;
