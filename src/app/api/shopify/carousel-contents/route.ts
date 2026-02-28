/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    // 1) Fetch metaobjects
    const metaQ = `
      query {
        metaobjects(type: "carousel_contents", first: 250) {
          edges {
            node {
              id
              fields { key value }
            }
          }
        }
      }
    `;

    const metaResp = await shopifyAdminFetch({ query: metaQ });
    const edges = metaResp?.data?.metaobjects?.edges ?? [];

    const raw = edges.map((e: any) => {
      const node = e.node || {};
      const fields = Array.isArray(node.fields) ? node.fields : [];
      const fieldsMap: Record<string, any> = {};
      for (const f of fields) fieldsMap[String(f.key)] = f.value;
      return { id: node.id, fieldsMap };
    });

    // 2) Collect unique image GIDs to resolve
    const gidSet = new Set<string>();
    for (const item of raw) {
      if (item.fieldsMap.content_img) gidSet.add(item.fieldsMap.content_img);
      if (item.fieldsMap.bg_img) gidSet.add(item.fieldsMap.bg_img);
    }
    const gids = Array.from(gidSet);

    // 3) Batch-resolve GIDs -> URLs
    const urlMap: Record<string, string> = {};
    if (gids.length > 0) {
      const nodesQ = `
        query($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on MediaImage {
              id
              image { url }
            }
          }
        }
      `;
      const nodesResp = await shopifyAdminFetch({
        query: nodesQ,
        variables: { ids: gids },
      });
      const nodes: any[] = nodesResp?.data?.nodes ?? [];
      for (const n of nodes) {
        if (n?.id && n?.image?.url) urlMap[n.id] = n.image.url;
      }
    }

    // 4) Build final results
    const results = raw.map((item: any) => {
      const fm = item.fieldsMap;
      let linkData: { text: string; url: string } | null = null;
      try {
        if (fm.link) linkData = JSON.parse(fm.link);
      } catch {
        /* ignore */
      }

      return {
        id: item.id,
        content_img: urlMap[fm.content_img] ?? null,
        bg_img: urlMap[fm.bg_img] ?? null,
        type: fm.type ?? "none",
        link: linkData,
      };
    });

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("carousel-contents error:", e);
    return NextResponse.json({ ok: false, results: [] });
  }
}
