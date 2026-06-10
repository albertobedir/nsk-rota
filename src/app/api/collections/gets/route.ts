/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Collection from "@/schemas/mongoose/collection";
import Product from "@/schemas/mongoose/product";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const {
      handle = "",
      page = "1",
      limit = "50",
    } = Object.fromEntries(req.nextUrl.searchParams) as Record<string, string>;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const query: Record<string, any> = {};
    if (handle) {
      // match by raw.handle or raw.title or shopify handle
      query["raw.handle"] = handle;
    }

    const total = await Collection.countDocuments(query);
    const results = (await Collection.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()) as any[];

    // Expand product docs for each collection (preserve original order)
    for (const coll of results) {
      try {
        const ids = Array.isArray(coll.products)
          ? coll.products.map((p: any) => Number(p.id)).filter(Boolean)
          : [];

        if (ids.length > 0) {
          const prods = await Product.find({ shopifyId: { $in: ids } }).lean();
          const prodMap: Record<number, any> = {};
          for (const p of prods) {
            prodMap[Number(p.shopifyId)] = p;
          }

          // Build ordered array matching collection.products order
          coll.productsFull = ids.map((id: number, idx: number) => {
            const found = prodMap[Number(id)];
            if (found) return found;
            const orig =
              coll.products && coll.products[idx] ? coll.products[idx] : { id };
            return {
              shopifyId: orig.id,
              raw: { title: orig.title, handle: orig.handle },
            };
          });
        } else {
          coll.productsFull = [];
        }
      } catch {
        coll.productsFull = [];
      }
    }

    return NextResponse.json({
      ok: true,
      total,
      page: pageNum,
      limit: limitNum,
      results,
    });
  } catch (err) {
    console.error("Collections API error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
