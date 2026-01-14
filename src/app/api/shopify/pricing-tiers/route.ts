/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const q = `
      query {
        metaobjects(type: "pricing_tier", first: 250) {
          edges {
            node {
              id
              fields { key value }
            }
          }
        }
      }
    `;

    const resp = await shopifyAdminFetch({ query: q });
    const edges = resp?.data?.metaobjects?.edges ?? [];

    const parsed = edges.map((e: any) => {
      const node = e.node || {};
      const fields = Array.isArray(node.fields) ? node.fields : [];
      const fieldsMap: Record<string, any> = {};
      for (const f of fields) fieldsMap[String(f.key)] = f.value;
      return { id: node.id, fields, fieldsMap };
    });

    return NextResponse.json({ ok: true, results: parsed });
  } catch (e) {
    console.error("pricing-tiers error:", e);
    return NextResponse.json({ ok: false, results: [] });
  }
}
