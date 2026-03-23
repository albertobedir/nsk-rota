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

    // ✅ GID'den numeric ID çıkar
    const normalizeShopifyId = (id: string) =>
      id.includes("/") ? id.split("/").pop()! : id;

    // ✅ customerId her zaman numeric olarak normalize et
    const normalizedCustomerId = customerId
      ? normalizeShopifyId(String(customerId))
      : undefined;

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
          return sum + price * qty;
        }, 0);
        console.log("Customer Credit:", remaining);
        console.log("Cart Total:", computedTotal);
        console.log("Line Items:", lines);

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

    let customerPrices: Record<string, number> = {};
    if (normalizedCustomerId) {
      const rows = await prisma.customerPricing.findMany({
        where: { customerId: String(normalizedCustomerId) },
        select: { metaobjectId: true, price: true },
      });
      customerPrices = Object.fromEntries(
        rows.map((r) => [r.metaobjectId, Number(r.price)]),
      );
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

      const explicit = li.customPrice ?? li.originalUnitPrice;
      if (explicit != null) {
        baseItem.originalUnitPrice = String(explicit);
        console.log(
          `[ITEM] variantId=${baseItem.variantId} explicit price=${baseItem.originalUnitPrice}`,
        );
        return baseItem;
      }

      const merchKey = li.merchandiseId ?? li.productId ?? undefined;
      const custPrice = merchKey ? customerPrices[merchKey] : undefined;

      if (custPrice != null) {
        baseItem.originalUnitPrice = String(custPrice);
        console.log(
          `[ITEM] variantId=${baseItem.variantId} customerPrice=${baseItem.originalUnitPrice}`,
        );
      } else {
        console.log(
          `[ITEM] variantId=${baseItem.variantId} NO price override — Shopify default will be used`,
        );
      }

      return baseItem;
    });

    const input = {
      // ✅ Numeric ID gönderiliyor, GID değil
      customerId: normalizedCustomerId
        ? `gid://shopify/Customer/${normalizedCustomerId}`
        : undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      lineItems: items,
      shippingAddress: shippingAddress ?? undefined,
      tags: ["b2b", "custom-pricing"],
      note: normalizedCustomerId
        ? `B2B Order - Custom pricing for ${normalizedCustomerId}`
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
