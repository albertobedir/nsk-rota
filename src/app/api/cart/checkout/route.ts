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
    const {
      lineItems,
      email,
      phone,
      shippingAddress,
      customerId,
      userTier,
      discountPercentage,
      discountCode,
    } = body;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { message: "No items provided" },
        { status: 400 },
      );
    }

    const lines = lineItems as IncomingLine[];
    const discount = Number(discountPercentage ?? 0);

    const normalizeShopifyId = (id: string) =>
      id.includes("/") ? id.split("/").pop()! : id;

    // ✅ DEBUG: Log incoming values
    console.log("[CHECKOUT REQUEST]", {
      customerId,
      userTier,
      discountPercentage,
      discountCode,
      lineItemsCount: lineItems.length,
      firstItem: lineItems[0],
    });

    if (customerId) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { shopifyId: normalizeShopifyId(String(customerId)) },
          select: { creditRemaining: true },
        });
        const remaining = Number(customer?.creditRemaining ?? 0);

        // Calculate total using tier discount
        const computedTotal = lines.reduce((sum, li) => {
          const qty = Number(li.quantity || 1);
          let price = Number(li.customPrice ?? li.originalUnitPrice ?? 0) || 0;

          // Apply tier discount if no explicit price
          if (!li.customPrice && discount > 0 && price > 0) {
            const discountedPrice = price * (1 - discount / 100);
            console.log(
              `[CREDIT CHECK] item: price=${price} × (1-${discount}/100) = ${discountedPrice.toFixed(2)}, qty=${qty}`,
            );
            price = discountedPrice;
          }

          return sum + price * qty;
        }, 0);

        console.log(
          `[CREDIT CHECK TOTAL] computedTotal=${computedTotal.toFixed(2)}, creditRemaining=${remaining}`,
        );

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

    // Get user's tier and discount percentage from request
    console.log(
      `[TIER] customerId=${customerId} userTier=${userTier} discount=${discount}%`,
    );

    const items = lines.map((li) => {
      const qty = Number(li.quantity || 1);
      const originalPrice = Number(li.originalUnitPrice ?? 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseItem: any = {
        quantity: qty,
        taxable: true,
        requiresShipping: true,
      };

      if (li.merchandiseId) baseItem.variantId = li.merchandiseId;
      else if (li.productId) baseItem.productId = li.productId;

      console.log(
        `\n[ITEM PROCESSING START] id=${baseItem.variantId} qty=${qty} originalPrice=${originalPrice}`,
      );

      // Determine which price to use
      let customPrice: number | undefined;
      const explicit = li.customPrice;

      if (explicit != null) {
        customPrice = Number(explicit);
        console.log(`[ITEM] EXPLICIT price found: customPrice=${customPrice}`);
      } else if (discount > 0 && originalPrice > 0) {
        // Apply tier-based discount
        customPrice = originalPrice * (1 - discount / 100);
        console.log(
          `[ITEM] TIER DISCOUNT applied: originalPrice=${originalPrice} × (1 - ${discount}/100) = ${customPrice.toFixed(2)}`,
        );
      } else {
        console.log(
          `[ITEM] NO discount applied (discount=${discount}, originalPrice=${originalPrice})`,
        );
      }

      // Apply discount if custom price differs from original
      if (
        customPrice != null &&
        originalPrice > 0 &&
        customPrice < originalPrice
      ) {
        // Use PERCENTAGE so Shopify applies discount on its own recorded price
        // (not on frontend's potentially discounted originalUnitPrice)
        baseItem.appliedDiscount = {
          value: discount,
          valueType: "PERCENTAGE",
          description: `B2B Tier Pricing - ${discount}% off`,
        };
        console.log(
          `[DISCOUNT APPLIED] PERCENTAGE approach: ${discount}% off (Shopify will apply to its recorded price)`,
        );
      } else {
        console.log(
          `[NO DISCOUNT] This item won't have discount (customPrice=${customPrice}, originalPrice=${originalPrice})`,
        );
      }

      console.log(
        `[ITEM PROCESSING END] final baseItem:`,
        JSON.stringify(baseItem, null, 2),
      );
      return baseItem;
    });

    const input = {
      customerId: customerId ? String(customerId) : undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      lineItems: items,
      shippingAddress: shippingAddress ?? undefined,
      tags: ["b2b", "custom-pricing"],
      note: customerId
        ? `B2B Order - Custom pricing for ${customerId}`
        : undefined,

      // Order-level discount code (tier discount'tan bağımsız çalışır)
      ...(discountCode?.trim()
        ? {
            appliedDiscount: {
              code: discountCode.trim(),
              value: 0,
              valueType: "PERCENTAGE" as const,
              title: discountCode.trim(),
              description: `Discount code: ${discountCode.trim()}`,
            },
          }
        : {}),
    };

    // ✅ LOG 2: Shopify'a gönderilen tam input
    console.log("[DRAFT ORDER INPUT]", JSON.stringify(input, null, 2));

    const created = await createDraftOrder(input);

    // ✅ LOG 3: Shopify'dan dönen response
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
