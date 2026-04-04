import { NextRequest, NextResponse } from "next/server";
import { calculateDraftOrder } from "@/lib/shopify/draft";

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

    const lines = (lineItems as IncomingLine[]).map((li) => ({
      variantId: li.variantId ?? undefined,
      quantity: Number(li.quantity ?? 1),
      originalUnitPrice: String(li.price ?? "0"),
      title: li.title ?? "Item",
      taxable: true,
      requiresShipping: true,
    }));

    // calculateDraftOrder kullan — gerçek draft oluşturmaz, sadece hesaplar
    const result = await calculateDraftOrder({
      lineItems: lines,
      appliedDiscount: {
        code: code.trim(),
        value: 0,
        valueType: "PERCENTAGE",
        title: code.trim(),
        description: code.trim(),
      },
    });

    const calculated = result?.calculatedDraftOrder;

    if (!calculated) {
      return NextResponse.json(
        { valid: false, message: "Could not validate code" },
        { status: 400 },
      );
    }

    // Eğer appliedDiscount yoksa veya boşsa kod geçersiz
    const applied = calculated.appliedDiscount;
    if (!applied || (Number(applied.value) === 0 && applied.valueType === "PERCENTAGE")) {
      // Shopify kodu tanımadıysa discount uygulanmaz
      // totalDiscount kontrolü daha güvenilir:
      const totalDiscount = calculated.lineItems?.reduce(
        (sum: number, li: { totalDiscount?: string }) =>
          sum + parseFloat(li.totalDiscount ?? "0"),
        0,
      ) ?? 0;

      if (totalDiscount === 0) {
        return NextResponse.json(
          { valid: false, message: "Invalid or inapplicable discount code" },
          { status: 200 },
        );
      }
    }

    const discountAmount = calculated.lineItems?.reduce(
      (sum: number, li: { totalDiscount?: string }) =>
        sum + parseFloat(li.totalDiscount ?? "0"),
      0,
    ) ?? 0;

    return NextResponse.json({
      valid: true,
      code: code.trim(),
      amount: discountAmount,
      valueType: applied?.valueType,
      value: applied?.value,
    });
  } catch (err) {
    console.error("[/api/cart/discount] error:", err);
    return NextResponse.json(
      { valid: false, message: "Server error" },
      { status: 500 },
    );
  }
}
