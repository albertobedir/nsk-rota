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
    const { lineItems, email, phone, shippingAddress, customerId } = body;

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

    if (normalizedCustomerId) {
      try {
        // Customer tablosundan tier tag'ini çek
        // Önce Customer modelinde tier alanı yok, shopifyTags User modelinde
        // O yüzden Shopify Admin REST API'den tag'leri çekiyoruz
        const shopifyRes = await fetch(
          `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/customers/${normalizedCustomerId}.json`,
          {
            headers: {
              "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
            },
          },
        );
        const shopifyData = await shopifyRes.json();
        const customerTags: string[] = (shopifyData.customer?.tags || "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

        console.log("[CUSTOMER TAGS]", customerTags);

        // tier-X tag'ini bul
        const tierTag = customerTags.find((t) => t.startsWith("tier-"));
        console.log("[TIER TAG]", tierTag);

        if (tierTag) {
          // ✅ PricingTier tablosundan indirim yüzdesini çek
          const tierData = await prisma.pricingTier.findFirst({
            where: { tierTag: tierTag },
            select: { discountPercentage: true, tierName: true },
          });

          if (tierData) {
            tierDiscountPercent = tierData.discountPercentage;
            tierDescription = `${tierData.tierName} - %${tierDiscountPercent} indirim`;
            console.log(`[TIER] ${tierTag} → %${tierDiscountPercent} indirim`);
          } else {
            console.warn(`[TIER] ${tierTag} için DB'de kayıt bulunamadı`);
          }
        }
      } catch (e) {
        console.warn("[TIER] Tier indirim çekme hatası:", e);
      }
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseItem: any = {
        quantity: qty,
        taxable: true,
        requiresShipping: true,
      };

      if (li.merchandiseId) baseItem.variantId = li.merchandiseId;
      else if (li.productId) baseItem.productId = li.productId;

      // ✅ Tier indirimi varsa appliedDiscount olarak uygula
      if (tierDiscountPercent > 0) {
        baseItem.appliedDiscount = {
          value: tierDiscountPercent,
          valueType: "PERCENTAGE",
          description: tierDescription,
        };
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
