import { NextRequest, NextResponse } from "next/server";
import { createDraftOrder } from "@/lib/shopify/draft";
import prisma from "@/lib/prisma/instance";

type IncomingLine = {
  merchandiseId?: string;
  productId?: string;
  quantity?: number;
  originalUnitPrice?: number | string;
  title?: string;
  customPrice?: number | string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineItems, email, phone, shippingAddress, customerId, tierTag } =
      body;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { message: "No items provided" },
        { status: 400 },
      );
    }

    const lines = lineItems as IncomingLine[];

    const normalizeShopifyId = (id: string) =>
      id.includes("/") ? id.split("/").pop()! : id;

    const normalizedCustomerId = customerId
      ? normalizeShopifyId(String(customerId))
      : undefined;

    // ✅ Müşterinin tier indirimini DB'den çek
    let tierDiscountPercent = 0;
    let tierDescription = "";

    console.log("[REQUEST BODY] tierTag:", tierTag);

    if (tierTag) {
      try {
        // Session store'dan gelen tierTag'i kullanarak PricingTier'ı bul
        console.log("[TIER TAG from request]", tierTag);

        const tierData = await prisma.pricingTier.findFirst({
          where: { tierTag: tierTag },
          select: { discountPercentage: true, tierName: true },
        });

        if (tierData) {
          tierDiscountPercent = tierData.discountPercentage;
          tierDescription = `${tierData.tierName} - %${tierDiscountPercent} indirim`;
          console.log(
            `[TIER] ${tierTag} → %${tierDiscountPercent} indirim (Prisma)`,
          );
        } else {
          console.warn(`[TIER] ${tierTag} için DB'de kayıt bulunamadı`);
        }
      } catch (e) {
        console.warn("[TIER] Tier indirim çekme hatası:", e);
      }
    } else {
      console.warn("[TIER] tierTag request'te gelmedi!");
    }

    // Credit check (indirimli fiyat üzerinden)
    if (normalizedCustomerId) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { shopifyId: normalizedCustomerId },
          select: { creditRemaining: true },
        });
        const remaining = Number(customer?.creditRemaining ?? 0);
        const computedTotal = lines.reduce((sum, li) => {
          const qty = Number(li.quantity || 1);
          const price =
            Number(li.customPrice ?? li.originalUnitPrice ?? 0) || 0;
          const discounted = price * (1 - tierDiscountPercent / 100);
          return sum + discounted * qty;
        }, 0);
        console.log("Customer Credit:", remaining);
        console.log("Cart Total (discounted):", computedTotal);

        if (computedTotal > remaining) {
          return NextResponse.json(
            { message: "Insufficient credit" },
            { status: 402 },
          );
        }
      } catch (e) {
        console.warn("Credit check failed", e);
      }
    }

    const items = lines.map((li) => {
      const qty = Number(li.quantity || 1);
      const originalPrice =
        Number(li.customPrice ?? li.originalUnitPrice ?? 0) || 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseItem: any = {
        quantity: qty,
        taxable: true,
        requiresShipping: true,
      };

      if (li.merchandiseId) baseItem.variantId = li.merchandiseId;
      else if (li.productId) baseItem.productId = li.productId;

      // ✅ Tier indirimi varsa indirimli fiyatı customPrice olarak set et
      if (tierDiscountPercent > 0) {
        const discountedPrice = (
          originalPrice *
          (1 - tierDiscountPercent / 100)
        ).toFixed(2);
        baseItem.customPrice = discountedPrice;
        console.log(
          `[LINE ITEM] Original: ${originalPrice}, Discounted: ${discountedPrice}`,
        );
      }

      return baseItem;
    });

    const input = {
      customerId: normalizedCustomerId
        ? `gid://shopify/Customer/${normalizedCustomerId}`
        : undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      lineItems: items,
      shippingAddress: shippingAddress ?? undefined,
      tags: ["b2b", "custom-pricing"],
      note: normalizedCustomerId
        ? `B2B Order - ${tierDescription || "Custom pricing"}`
        : undefined,
    };

    console.log("[DRAFT ORDER INPUT]", JSON.stringify(input, null, 2));

    const created = await createDraftOrder(input);

    console.log("[DRAFT ORDER RESPONSE]", JSON.stringify(created, null, 2));

    return NextResponse.json({ created });
  } catch (err) {
    console.error("/api/cart/checkout error:", err);
    return NextResponse.json(
      { message: "Error creating draft" },
      { status: 500 },
    );
  }
}
