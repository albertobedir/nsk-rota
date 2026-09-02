/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import { extractNumericId, toOrderGid } from "@/lib/shopify/ids";

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

    const isMongoObjectId =
      mongoose.Types.ObjectId.isValid(id) &&
      String(new mongoose.Types.ObjectId(id)) === id;

    if (isMongoObjectId) {
      order = await Order.findById(id).lean();
    }

    const shopifyCandidate = extractNumericId(id);
    const orderGid = toOrderGid(id);

    if (!order) {
      order = await Order.findOne({
        $or: [
          { shopifyId: id },
          ...(orderGid ? [{ shopifyId: orderGid }] : []),
          ...(shopifyCandidate
            ? [
                { shopifyId: shopifyCandidate },
                { "raw.id": Number(shopifyCandidate) },
                { "raw.id": shopifyCandidate },
                { orderNumber: Number(shopifyCandidate) },
              ]
            : []),
        ],
      }).lean();
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
    console.log("=== 🏠 RAW ADDRESS DEBUG ===");
    console.log(
      "billingAddress:",
      JSON.stringify(order.billingAddress, null, 2),
    );
    console.log(
      "shippingAddress:",
      JSON.stringify(order.shippingAddress, null, 2),
    );
    console.log(
      "raw.billing_address:",
      JSON.stringify(order.raw?.billing_address, null, 2),
    );
    console.log(
      "raw.shippingAddress:",
      JSON.stringify(order.raw?.shippingAddress, null, 2),
    );
    console.log("=== END ADDRESS DEBUG ===");
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
