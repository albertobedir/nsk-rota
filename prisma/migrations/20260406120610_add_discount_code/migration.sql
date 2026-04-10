-- CreateEnum
CREATE TYPE "StackingType" AS ENUM ('COMPOUND', 'ADDITIVE', 'MAX');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "creditRemaining" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "creditUsed" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "customerCode" TEXT,
ADD COLUMN     "deliveryTerms" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "shippingAddress" JSONB,
ADD COLUMN     "shopifyTags" JSONB,
ADD COLUMN     "tier" TEXT,
ADD COLUMN     "zip" TEXT,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "creditLimit" DECIMAL(10,2),
    "creditUsed" DECIMAL(10,2),
    "creditRemaining" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL,
    "metaobjectId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "tierTag" TEXT NOT NULL,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shopifyId" TEXT,
    "title" TEXT,
    "valueType" "DiscountValueType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DOUBLE PRECISION NOT NULL,
    "stackingType" "StackingType" NOT NULL DEFAULT 'COMPOUND',
    "minimumCartAmount" DOUBLE PRECISION,
    "allowedTiers" TEXT[],
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopifyId_key" ON "Customer"("shopifyId");

-- CreateIndex
CREATE INDEX "Customer_shopifyId_idx" ON "Customer"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_metaobjectId_key" ON "PricingTier"("metaobjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_tierTag_key" ON "PricingTier"("tierTag");

-- CreateIndex
CREATE INDEX "PricingTier_tierTag_idx" ON "PricingTier"("tierTag");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_code_idx" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_shopifyId_idx" ON "DiscountCode"("shopifyId");

-- CreateIndex
CREATE INDEX "DiscountCode_active_idx" ON "DiscountCode"("active");
