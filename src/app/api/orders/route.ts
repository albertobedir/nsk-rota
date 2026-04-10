/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const customerId = new URL(req.url).searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Missing customerId" },
        { status: 400 },
      );
    }

    await connectDB();

    // GID veya numeric ID her ikisini de handle et
    const numericId = customerId.includes("gid://")
      ? Number(customerId.split("/").pop())
      : Number(customerId);

    // Fetch orders from MongoDB for this customer (query raw.customer.id)
    const orders = await Order.find({
      "raw.customer.id": numericId,
    }).sort({ createdAt: -1 });

    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("orders route error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
