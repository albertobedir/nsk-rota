-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "allCustomers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appliesOncePerCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appliesToAll" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appliesToCollections" TEXT[],
ADD COLUMN     "appliesToProducts" TEXT[],
ADD COLUMN     "combinesWithOrderDiscounts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "combinesWithProductDiscounts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "combinesWithShippingDiscounts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customerSegments" JSONB,
ADD COLUMN     "specificCustomers" TEXT[];

-- CreateIndex
CREATE INDEX "DiscountCode_allCustomers_idx" ON "DiscountCode"("allCustomers");
