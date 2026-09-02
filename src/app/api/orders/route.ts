/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import {
  buildCustomerOrderMongoQuery,
  resolveCustomerIdentity,
} from "@/lib/orders/customer";
import { formatOrderMoney } from "@/lib/orders/line-items";
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

    const identity = await resolveCustomerIdentity(customerId);
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: "Missing customerId" },
        { status: 400 },
      );
    }

    await connectDB();

    const query = buildCustomerOrderMongoQuery(identity);
    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const mapped = orders.map((order) => {
      const statusInfo = getOrderStatusInfo(order);
      const money = formatOrderMoney(order);

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
        totalPrice: {
          amount: money.amount || null,
          currencyCode: money.currency,
        },
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
