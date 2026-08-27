/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import {
  formatCancelReason,
  formatOrderStatus,
  getOrderStatusInfo,
  parseOrderTags,
} from "@/lib/orders/status";

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

    const customerGid = customerId.startsWith("gid://")
      ? customerId
      : Number.isNaN(numericId)
        ? null
        : `gid://shopify/Customer/${numericId}`;

    const query: Record<string, unknown> = Number.isNaN(numericId)
      ? { customerId: customerGid || customerId }
      : {
          $or: [
            { "raw.customer.id": numericId },
            ...(customerGid ? [{ customerId: customerGid }] : []),
          ],
        };

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const mapped = orders.map((order) => {
      const statusInfo = getOrderStatusInfo(order);

      return {
        ...order,
        poNumber: order.poNumber || order.raw?.po_number || null,
        tags: parseOrderTags(order),
        cancelled: statusInfo.cancelled,
        cancelledAt: order.cancelledAt || order.raw?.cancelled_at || null,
        cancelReason: formatCancelReason(
          (order.cancelReason || order.raw?.cancel_reason) as string | null,
        ),
        financialStatus:
          order.financialStatus || order.raw?.financial_status || null,
        fulfillmentStatus:
          order.fulfillmentStatus || order.raw?.fulfillment_status || null,
        paymentStatus: statusInfo.paymentLabel,
        paymentKey: statusInfo.paymentKey,
        shipmentStatus: statusInfo.shipmentLabel,
        shipmentKey: statusInfo.shipmentKey,
        trackings: statusInfo.trackings,
        status: formatOrderStatus(order),
      };
    });

    return NextResponse.json({ ok: true, orders: mapped });
  } catch (err) {
    console.error("orders route error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
