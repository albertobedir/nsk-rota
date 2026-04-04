import { NextRequest, NextResponse } from "next/server";
import { getDiscountByCode } from "@/lib/shopify/draft";

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

    // 1) Discount detayını çek — status + minimum requirement
    const discount = await getDiscountByCode(code.trim());

    console.log(
      `[DISCOUNT LOOKUP] code="${code.trim()}"`,
      JSON.stringify(
        {
          found: !!discount,
          discount,
        },
        null,
        2,
      ),
    );

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

    // 2) Cart toplamlarını hesapla
    const cartSubtotal = (lineItems as IncomingLine[]).reduce(
      (sum, li) => sum + Number(li.price ?? 0) * Number(li.quantity ?? 1),
      0,
    );
    const cartTotalQty = (lineItems as IncomingLine[]).reduce(
      (sum, li) => sum + Number(li.quantity ?? 1),
      0,
    );

    // 3) Minimum koşul kontrolü
    const minReq = discount.minimumRequirement;

    if (minReq?.greaterThanOrEqualToSubtotal) {
      const minAmount = parseFloat(
        minReq.greaterThanOrEqualToSubtotal.amount ?? "0",
      );
      const currency =
        minReq.greaterThanOrEqualToSubtotal.currencyCode ?? "USD";

      if (cartSubtotal < minAmount) {
        const needed = (minAmount - cartSubtotal).toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        const minFmt = minAmount.toLocaleString("en-US", {
          style: "currency",
          currency,
        });
        return NextResponse.json({
          valid: false,
          message: `Minimum cart total of ${minFmt} required. Add ${needed} more to use this code.`,
          requirementType: "MIN_SUBTOTAL",
          required: minAmount,
          current: cartSubtotal,
        });
      }
    }

    if (minReq?.greaterThanOrEqualToQuantity) {
      const minQty = Number(minReq.greaterThanOrEqualToQuantity);
      if (cartTotalQty < minQty) {
        return NextResponse.json({
          valid: false,
          message: `Minimum ${minQty} items required. Your cart has ${cartTotalQty} item${cartTotalQty !== 1 ? "s" : ""}.`,
          requirementType: "MIN_QUANTITY",
          required: minQty,
          current: cartTotalQty,
        });
      }
    }

    // 4) REST API ile gerçek draft oluştur → amount oku → hemen sil
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!;
    const shopifyToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;

    const body = JSON.stringify({
      draft_order: {
        line_items: (lineItems as IncomingLine[]).map((li) => ({
          variant_id: li.variantId,
          quantity: Number(li.quantity ?? 1),
          price: String(li.price ?? "0"),
          title: li.title ?? "Item",
        })),
        applied_discount: {
          code: code.trim(),
          value_type: "percentage",
          value: "0",
          title: code.trim(),
          description: code.trim(),
        },
      },
    });

    console.log("[REST REQUEST BODY]", body);

    const restResp = await fetch(
      `https://${shopifyDomain}/admin/api/2025-01/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": shopifyToken,
        },
        body,
      },
    );

    const restText = await restResp.text();
    console.log("[REST RAW RESPONSE]", restText);

    const restJson = JSON.parse(restText);

    console.log(
      "[REST DRAFT RESPONSE]",
      JSON.stringify(
        {
          id: restJson?.draft_order?.id,
          subtotal: restJson?.draft_order?.subtotal_price,
          total: restJson?.draft_order?.total_price,
          appliedDiscount: restJson?.draft_order?.applied_discount,
          errors: restJson?.errors,
          lineItems: restJson?.draft_order?.line_items?.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (li: any) => ({
              title: li.title,
              price: li.price,
              quantity: li.quantity,
              appliedDiscount: li.applied_discount,
            }),
          ),
        },
        null,
        2,
      ),
    );

    // Draft'ı hemen sil
    if (restJson?.draft_order?.id) {
      await fetch(
        `https://${shopifyDomain}/admin/api/2025-01/draft_orders/${restJson.draft_order.id}.json`,
        {
          method: "DELETE",
          headers: { "X-Shopify-Access-Token": shopifyToken },
        },
      ).catch((e) => console.warn("[DISCOUNT] cleanup failed:", e));
    }

    const draft = restJson?.draft_order;
    if (!draft || restJson?.errors) {
      const errorMsg =
        restJson?.errors?.base?.[0] ??
        restJson?.errors?.[0] ??
        "Could not validate code";
      return NextResponse.json(
        { valid: false, message: errorMsg },
        { status: 200 },
      );
    }

    const applied = draft.applied_discount;
    if (!applied) {
      return NextResponse.json(
        { valid: false, message: "Discount could not be applied to your cart" },
        { status: 200 },
      );
    }

    const subtotal = parseFloat(draft.subtotal_price ?? "0");
    const totalPrice = parseFloat(draft.total_price ?? "0");
    const discountAmount = Math.max(0, subtotal - totalPrice);

    console.log("[SUCCESS]", {
      code: code.trim(),
      amount: discountAmount,
      valueType: applied.value_type,
      value: applied.value,
    });

    return NextResponse.json({
      valid: true,
      code: code.trim(),
      amount: discountAmount,
      valueType: applied.value_type,
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
