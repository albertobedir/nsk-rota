/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  // prefer route params (which may be a Promise), but fall back to parsing the id from the request URL
  let resolvedParams: { id: string } | undefined = undefined;
  if (params) {
    // handle case where params is a Promise (Next.js types can surface this)
    const p: any = params;
    resolvedParams = typeof p.then === "function" ? await p : p;
  }
  let id = resolvedParams?.id;
  if (!id) {
    try {
      const url = new URL(_req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[parts.length - 1] || undefined;
      if (id) id = decodeURIComponent(id);
    } catch (e) {
      // ignore and let validation below return a helpful error
    }
  }
  try {
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 },
      );
    }

    await connectDB();

    let order: any = null;

    // If the incoming id is a plain Mongo ObjectId, try that first
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id).lean();
    }

    // Extract possible Shopify numeric id from values like
    // "gid://shopify/Order/6419982483527" or "/.../6419982483527"
    const shopifyCandidateMatch = id.match(/(\d+)$/);
    const shopifyCandidate = shopifyCandidateMatch
      ? shopifyCandidateMatch[1]
      : id.includes("/")
        ? id.split("/").pop() || id
        : id;

    // Try matching by shopifyId (numeric first)
    if (!order) {
      console.log("\n=== 🔍 MONGO SEARCH DEBUG ===");
      console.log("Searching by numeric shopifyId:", shopifyCandidate);
      order = await Order.findOne({ shopifyId: shopifyCandidate }).lean();
      console.log("Result:", order ? "✅ Found" : "❌ Not found");
    }

    // Try matching by full GID format
    if (!order) {
      const fullGid = `gid://shopify/Order/${shopifyCandidate}`;
      console.log("Searching by full GID:", fullGid);
      order = await Order.findOne({
        shopifyId: fullGid,
      }).lean();
      console.log("Result:", order ? "✅ Found" : "❌ Not found");
    }

    // Fallback: try numeric orderNumber when candidate is numeric
    if (!order && !Number.isNaN(Number(shopifyCandidate))) {
      console.log("Searching by orderNumber:", Number(shopifyCandidate));
      order = await Order.findOne({
        orderNumber: Number(shopifyCandidate),
      }).lean();
      console.log("Result:", order ? "✅ Found" : "❌ Not found");
    }

    if (!order) {
      console.log("❌ ORDER NOT FOUND - No matching records in Mongo");
      console.log("=== END MONGO SEARCH ===\n");
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );
    }

    console.log("✅ ORDER FOUND");
    console.log("Mongo order raw field exists:", !!order.raw);
    console.log(
      "Mongo order raw.line_items:",
      order.raw?.line_items ? "exists" : "missing",
    );
    console.log(
      "Mongo order raw.lineItems:",
      order.raw?.lineItems ? "exists" : "missing",
    );
    console.log("=== END MONGO SEARCH ===\n");

    // Return shape expected by the client page (d.data.data.node)
    return NextResponse.json({ ok: true, data: { data: { node: order } } });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
