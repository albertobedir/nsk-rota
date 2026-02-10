import { NextRequest, NextResponse } from "next/server";
import { createDraftOrder } from "@/lib/shopify/draft";
import prisma from "@/lib/prisma/instance";

type IncomingLine = {
  merchandiseId?: string;
  productId?: string;
  quantity?: number;
  originalUnitPrice?: number | string;
  title?: string;
  customPrice?: number | string; // explicit override from client
};

/**
 * POST /api/cart/checkout
 * Body: { lineItems: [{ merchandiseId: string, quantity: number, price?: number, title?: string }], email?: string, phone?: string }
 */
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

    // Normalize
    const lines = lineItems as IncomingLine[];

    // Server-side credit check: if customerId provided, ensure customer's creditRemaining covers cart total
    if (customerId) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { shopifyId: String(customerId) },
          select: { creditRemaining: true },
        });
        const remaining = Number(customer?.creditRemaining ?? 0);
        // compute total from provided line items (prefer explicit prices)
        const computedTotal = lines.reduce((sum, li) => {
          const qty = Number(li.quantity || 1);
          const price =
            Number(li.customPrice ?? li.originalUnitPrice ?? 0) || 0;
          return sum + price * qty;
        }, 0);

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

    // Fetch customer-specific prices from DB (if customerId provided)
    let customerPrices: Record<string, number> = {};
    if (customerId) {
      const rows = await prisma.customerPricing.findMany({
        where: { customerId: String(customerId) },
        select: { metaobjectId: true, price: true },
      });

      // metaobjectId is stored in DB; we expose it keyed by metaobjectId
      customerPrices = Object.fromEntries(
        rows.map((r) => [r.metaobjectId, Number(r.price)]),
      );
    }

    const items = lines.map((li) => {
      const qty = Number(li.quantity || 1);

      // client-side explicit override takes precedence
      const explicit = li.customPrice ?? li.originalUnitPrice;
      if (explicit != null) {
        return {
          title: li.title || "Custom Item",
          quantity: qty,
          originalUnitPrice: String(explicit),
          taxable: true,
          requiresShipping: true,
        };
      }

      // attempt to find a customer-specific price by matching keys
      // Try direct merchandiseId/productId match first
      const merchKey = li.merchandiseId ?? li.productId ?? undefined;
      const custPrice = merchKey ? customerPrices[merchKey] : undefined;

      if (custPrice != null) {
        return {
          title: li.title || "Custom Priced Item",
          quantity: qty,
          originalUnitPrice: String(custPrice),
          taxable: true,
          requiresShipping: true,
        };
      }

      // fallback to normal variant/product line
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any = { quantity: qty };
      if (li.merchandiseId) out.variantId = li.merchandiseId;
      if (li.productId) out.productId = li.productId;
      return out;
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
    };

    const created = await createDraftOrder(input);

    return NextResponse.json({ created });
  } catch (err) {
    console.error("/api/cart/checkout error:", err);
    return NextResponse.json(
      { message: "Error creating draft" },
      { status: 500 },
    );
  }
}
