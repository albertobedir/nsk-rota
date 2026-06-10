import { NextResponse } from "next/server";
import { getAllCustomerPricing } from "@/lib/shopify/customerPricing";

export async function GET() {
  try {
    const metaobjects = await getAllCustomerPricing();
    return NextResponse.json({
      ok: true,
      count: metaobjects.length,
      data: metaobjects,
    });
  } catch (err) {
    console.error("/api/shopify/customer-pricing error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
