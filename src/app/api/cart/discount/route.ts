import { NextRequest, NextResponse } from "next/server";
import { calculateDraftOrder, getDiscountByCode } from "@/lib/shopify/draft";

type IncomingLine = {
  variantId?: string;
  quantity?: number;
  price?: number | string;
  title?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { code, lineItems } = await req.json();

    if (!code?.trim()) {
      return NextResponse.json(
        { valid: false, message: "No code provided" },
        { status: 400 },
      );
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { valid: false, message: "No line items provided" },
        { status: 400 },
      );
    }

    // 1) Discount detayını çek
    const discount = await getDiscountByCode(code.trim());

    if (!discount) {
      return NextResponse.json(
        { valid: false, message: "Discount code not found" },
        { status: 200 },
      );
    }

    if (discount.status !== "ACTIVE") {
      return NextResponse.json(
        { valid: false, message: "This discount code is no longer active" },
        { status: 200 },
      );
    }

    // 2) Cart değerlerini hesapla
    const cartSubtotal = (lineItems as IncomingLine[]).reduce(
      (sum, li) => sum + Number(li.price ?? 0) * Number(li.quantity ?? 1),
      0,
    );
    const cartTotalQty = (lineItems as IncomingLine[]).reduce(
      (sum, li) => sum + Number(li.quantity ?? 1),
      0,
    );

    // 3) Minimum koşul kontrolü — spesifik mesaj üret
    const minReq = discount.minimumRequirement;

    if (minReq?.greaterThanOrEqualToSubtotal) {
      const minAmount = parseFloat(
        minReq.greaterThanOrEqualToSubtotal.amount ?? "0",
      );
      const currency =
        minReq.greaterThanOrEqualToSubtotal.currencyCode ?? "USD";

      if (cartSubtotal < minAmount) {
        const formatted = minAmount.toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        const currentFormatted = cartSubtotal.toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        return NextResponse.json(
          {
            valid: false,
            message: `Minimum cart total of ${formatted} required. Your cart is ${currentFormatted}.`,
            requirementType: "MIN_SUBTOTAL",
            required: minAmount,
            current: cartSubtotal,
          },
          { status: 200 },
        );
      }
    }

    if (minReq?.greaterThanOrEqualToQuantity) {
      const minQty = Number(minReq.greaterThanOrEqualToQuantity);
      if (cartTotalQty < minQty) {
        return NextResponse.json(
          {
            valid: false,
            message: `Minimum ${minQty} items required. Your cart has ${cartTotalQty} item${cartTotalQty !== 1 ? "s" : ""}.`,
            requirementType: "MIN_QUANTITY",
            required: minQty,
            current: cartTotalQty,
          },
          { status: 200 },
        );
      }
    }

    // 4) calculateDraftOrder ile amount'u hesapla
    const lines = (lineItems as IncomingLine[]).map((li) => ({
      variantId: li.variantId ?? undefined,
      quantity: Number(li.quantity ?? 1),
      originalUnitPrice: String(li.price ?? "0"),
      title: li.title ?? "Item",
      taxable: true,
      requiresShipping: true,
    }));

    const result = await calculateDraftOrder({
      lineItems: lines,
      appliedDiscount: {
        code: code.trim(),
        title: code.trim(),
        value: 0,
        valueType: "PERCENTAGE",
        description: code.trim(),
      },
    });

    const calculated = result?.calculatedDraftOrder;
    const userErrors = result?.userErrors;

    if (userErrors?.length > 0) {
      return NextResponse.json(
        { valid: false, message: userErrors[0]?.message ?? "Invalid code" },
        { status: 200 },
      );
    }

    if (!calculated) {
      return NextResponse.json(
        { valid: false, message: "Could not calculate discount" },
        { status: 400 },
      );
    }

    const applied = calculated.appliedDiscount;
    if (!applied) {
      return NextResponse.json(
        { valid: false, message: "Discount could not be applied to your cart" },
        { status: 200 },
      );
    }

    // 5) Amount hesapla — subtotal vs totalPrice
    const subtotal = parseFloat(calculated.subtotalPrice ?? "0");
    const totalPrice = parseFloat(calculated.totalPrice ?? "0");
    const tax = parseFloat(calculated.totalTax ?? "0");
    const discountAmount = Math.max(0, subtotal - (totalPrice - tax));

    return NextResponse.json({
      valid: true,
      code: code.trim(),
      amount: discountAmount,
      valueType: applied.valueType,
      value: applied.value,
    });
  } catch (err) {
    console.error("[/api/cart/discount] error:", err);
    return NextResponse.json(
      { valid: false, message: "Server error" },
      { status: 500 },
    );
  }
}
