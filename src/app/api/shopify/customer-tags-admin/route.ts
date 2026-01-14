/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const customerId = req.cookies.get("customer_id")?.value;
    if (!customerId) return NextResponse.json({ ok: false, tags: [] });

    // customerId may already be gid like gid://shopify/Customer/123
    const q = `
      query getCustomerAdmin($id: ID!) {
        node(id: $id) {
          ... on Customer { tags }
        }
      }
    `;

    const resp = await shopifyAdminFetch({
      query: q,
      variables: { id: customerId },
    });
    const tags = resp?.data?.node?.tags ?? [];
    return NextResponse.json({ ok: true, tags });
  } catch (e) {
    console.error("customer-tags-admin error:", e);
    return NextResponse.json({ ok: false, tags: [] });
  }
}
