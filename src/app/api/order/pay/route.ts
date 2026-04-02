/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createDraftOrder } from "@/lib/shopify/draft";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderName, totalAmount, customerId } = body;

    if (!orderId || !totalAmount) {
      return NextResponse.json(
        { message: "orderId and totalAmount are required" },
        { status: 400 },
      );
    }

    console.log("[/api/order/pay] Started:", {
      orderId,
      orderName,
      totalAmount,
      customerId,
    });

    // 2. Create Draft Order with custom item
    const result = await createDraftOrder({
      customerId: customerId ? String(customerId) : undefined,
      lineItems: [
        {
          title: `${orderName || orderId} Order Payment`,
          quantity: 1,
          originalUnitPrice: String(Number(totalAmount).toFixed(2)),
          taxable: false,
          requiresShipping: false,
        },
      ],
      tags: [
        "credit-card-payment",
        `order-ref-${String(orderName).replace("#", "")}`,
      ],
      note: `Credit card payment — Original Order: ${orderName} (${orderId})`,
    });

    // Check for userErrors
    if (result?.userErrors?.length > 0) {
      console.error("[/api/order/pay] userErrors:", result.userErrors);
      return NextResponse.json(
        { message: result.userErrors[0].message },
        { status: 400 },
      );
    }

    const invoiceUrl = result?.draftOrder?.invoiceUrl;

    // 3. Return invoice URL to frontend
    return NextResponse.json({
      invoiceUrl,
      draftOrderId: result?.draftOrder?.id,
    });
  } catch (err: any) {
    console.error("[/api/order/pay] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
