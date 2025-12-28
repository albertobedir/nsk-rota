import { getAllCustomerPricing } from "@/lib/shopify/customerPricing";
import prisma from "@/lib/prisma/instance";

export async function syncCustomerPricingToDatabase() {
  console.log("🔄 Starting customer pricing sync...");
  const metaobjects = await getAllCustomerPricing();
  console.log(`📦 Fetched ${metaobjects.length} pricing records from Shopify`);

  let upsertedCount = 0;
  let errorCount = 0;

  for (const pricing of metaobjects) {
    try {
      await prisma.customerPricing.upsert({
        where: { metaobjectId: pricing.id },
        update: {
          customerId: pricing.customerId ?? "",
          productId: pricing.productId ?? "",
          price: pricing.price ?? 0,
          updatedAt: pricing.updatedAt
            ? new Date(pricing.updatedAt)
            : undefined,
        },
        create: {
          metaobjectId: pricing.id,
          customerId: pricing.customerId ?? "",
          productId: pricing.productId ?? "",
          price: pricing.price ?? 0,
          createdAt: pricing.updatedAt
            ? new Date(pricing.updatedAt)
            : undefined,
          updatedAt: pricing.updatedAt
            ? new Date(pricing.updatedAt)
            : undefined,
        },
      });
      upsertedCount++;
    } catch (err) {
      console.error(`❌ Error syncing ${pricing.id}:`, err);
      errorCount++;
    }
  }

  // Soft-delete any DB entries that no longer exist in Shopify metaobjects
  const shopifyIds = metaobjects.map((m) => m.id);
  try {
    await prisma.customerPricing.updateMany({
      where: {
        metaobjectId: { notIn: shopifyIds },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  } catch (e) {
    console.warn("Failed to mark deleted metaobjects:", e);
  }

  console.log(
    `✅ Sync completed: ${upsertedCount} upserted, ${errorCount} errors`
  );

  return {
    success: true,
    upserted: upsertedCount,
    errors: errorCount,
    total: metaobjects.length,
  };
}
