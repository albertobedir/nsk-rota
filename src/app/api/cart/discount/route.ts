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

    console.log(`[DISCOUNT LOOKUP] code="${code.trim()}"`, {
      found: !!discount,
      discount: discount
        ? {
            title: discount.title,
            status: discount.status,
            minimumRequirement: discount.minimumRequirement,
          }
        : null,
    });

    if (!discount) {
      return NextResponse.json(
        { valid: false, message: "Discount code not found" },
        { status: 200 },
      );
    }

    if (discount.status !== "ACTIVE") {
      console.log(`[DISCOUNT STATUS] status="${discount.status}" → REJECTED`);
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

    console.log("[CART TOTALS]", {
      subtotal: cartSubtotal,
      totalQty: cartTotalQty,
      lineItemsCount: lineItems.length,
    });

    // 3) Minimum koşul kontrolü — spesifik mesaj üret
    const minReq = discount.minimumRequirement;

    console.log("[MIN REQUIREMENT CHECK]", {
      hasMinReq: !!minReq,
      hasSubtotalReq: !!minReq?.greaterThanOrEqualToSubtotal,
      hasQtyReq: !!minReq?.greaterThanOrEqualToQuantity,
    });

    if (minReq?.greaterThanOrEqualToSubtotal) {
      const minAmount = parseFloat(
        minReq.greaterThanOrEqualToSubtotal.amount ?? "0",
      );
      const currency =
        minReq.greaterThanOrEqualToSubtotal.currencyCode ?? "USD";

      console.log("[MIN SUBTOTAL CHECK]", {
        required: minAmount,
        current: cartSubtotal,
        passed: cartSubtotal >= minAmount,
      });

      if (cartSubtotal < minAmount) {
        const formatted = minAmount.toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        const currentFormatted = cartSubtotal.toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        console.log(
          "[MIN SUBTOTAL REJECTED]",
          formatted,
          "vs",
          currentFormatted,
        );
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

      console.log("[MIN QUANTITY CHECK]", {
        required: minQty,
        current: cartTotalQty,
        passed: cartTotalQty >= minQty,
      });

      if (cartTotalQty < minQty) {
        const msg = `Minimum ${minQty} items required. Your cart has ${cartTotalQty} item${cartTotalQty !== 1 ? "s" : ""}.`;
        console.log("[MIN QUANTITY REJECTED]", msg);
        return NextResponse.json(
          {
            valid: false,
            message: msg,
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

    console.log("[CALC DRAFT ORDER INPUT]", {
      linesCount: lines.length,
      firstLine: lines[0],
      appliedDiscount: {
        code: code.trim(),
        title: code.trim(),
        value: 0,
        valueType: "PERCENTAGE",
        description: code.trim(),
      },
    });

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

    console.log("[CALC RESULT]", JSON.stringify(result, null, 2));

    const calculated = result?.calculatedDraftOrder;
    const userErrors = result?.userErrors;

    console.log("[CALC RESULT PARSED]", {
      hasCalculated: !!calculated,
      userErrors: userErrors,
      calculatedDraft: calculated
        ? {
            subtotalPrice: calculated.subtotalPrice,
            totalPrice: calculated.totalPrice,
            totalTax: calculated.totalTax,
            appliedDiscount: calculated.appliedDiscount,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lineItems: calculated.lineItems?.map((li: any) => ({
              title: li.title,
              quantity: li.quantity,
              originalUnitPrice: li.originalUnitPrice,
              totalDiscount: li.totalDiscount,
            })),
          }
        : null,
    });

    if (userErrors?.length > 0) {
      console.log("[USER ERROR]", userErrors[0]?.message);
      return NextResponse.json(
        { valid: false, message: userErrors[0]?.message ?? "Invalid code" },
        { status: 200 },
      );
    }

    if (!calculated) {
      console.log("[NO CALCULATED DRAFT]");
      return NextResponse.json(
        { valid: false, message: "Could not calculate discount" },
        { status: 400 },
      );
    }

    const applied = calculated.appliedDiscount;
    if (!applied) {
      console.log("[NO APPLIED DISCOUNT]");
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

    console.log("[DISCOUNT AMOUNT CALC]", {
      subtotal,
      totalPrice,
      tax,
      formula: `${subtotal} - (${totalPrice} - ${tax})`,
      discountAmount,
    });

    console.log("[SUCCESS]", {
      code: code.trim(),
      amount: discountAmount,
      valueType: applied.valueType,
      value: applied.value,
    });

    return NextResponse.json({
      valid: true,
      code: code.trim(),
      amount: discountAmount,
      valueType: applied.valueType,
      value: applied.value,
    });
  } catch (err) {
    console.error("[/api/cart/discount] EXCEPTION", err);
    return NextResponse.json(
      { valid: false, message: "Server error" },
      { status: 500 },
    );
  }
}
