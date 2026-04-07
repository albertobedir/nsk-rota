import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";

/**
 * GET /api/customer/pricing?customerId=...&productShopifyId=...
 *
 * Fetches customer-specific pricing for a product.
 * Priority:
 * 1. Customer Pricing (if exists) → NO tier discount applied
 * 2. Return null if not found
 */
export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customerId");
    const productShopifyId = req.nextUrl.searchParams.get("productShopifyId");

    if (!customerId || !productShopifyId) {
      return NextResponse.json(
        { ok: false, message: "Missing customerId or productShopifyId" },
        { status: 400 },
      );
    }

    // Look up customer pricing for this specific product
    const customerPricing = await prisma.customerPricing.findFirst({
      where: {
        customerId: String(customerId),
        productShopifyId: String(productShopifyId),
      },
    });

    if (!customerPricing) {
      return NextResponse.json({
        ok: true,
        price: null,
      });
    }

    return NextResponse.json({
      ok: true,
      price: Number(customerPricing.price),
      customerId: customerPricing.customerId,
      productShopifyId: customerPricing.productShopifyId,
    });
  } catch (e) {
    console.error("/api/customer/pricing error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
