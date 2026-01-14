/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("shopifyAccessToken")?.value;
    if (!token) return NextResponse.json({ ok: false, tags: [] });

    const q = `
      query getCustomerTags($customerAccessToken: String!) {
        customer(customerAccessToken: $customerAccessToken) {
          tags
        }
      }
    `;

    const resp = await shopifyFetch({
      query: q,
      variables: { customerAccessToken: token },
    });
    const tags = resp?.data?.customer?.tags ?? [];
    return NextResponse.json({ ok: true, tags });
  } catch (e) {
    console.error("customer-tags error:", e);
    return NextResponse.json({ ok: false, tags: [] });
  }
}
