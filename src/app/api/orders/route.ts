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
import { extractNumericId } from "@/lib/shopify/ids";
import {
  applyShopifyOrderUpdate,
} from "@/lib/shopify/order-webhook";
import { fetchShopifyRestOrdersByIds } from "@/lib/shopify/order-rest";

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
    let orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    try {
      const refreshIds = orders
        .filter((order) => {
          if (order.cancelledAt || order.raw?.cancelled_at) return false;
          const fulfillment = String(
            order.fulfillmentStatus || order.raw?.fulfillment_status || "",
          ).toLowerCase();
          const shipments = Array.isArray(order.raw?.fulfillments)
            ? order.raw.fulfillments.map((f: any) =>
                String(f?.shipment_status || f?.shipmentStatus || "").toLowerCase(),
              )
            : [];
          if (fulfillment === "delivered" || shipments.includes("delivered")) {
            return false;
          }
          return true;
        })
        .map(
          (order) =>
            extractNumericId(order.shopifyId) ||
            extractNumericId(
              typeof order.raw?.id === "string" ||
                typeof order.raw?.id === "number"
                ? order.raw.id
                : null,
            ),
        );

      const liveOrders = await fetchShopifyRestOrdersByIds(refreshIds);
      if (liveOrders.length > 0) {
        await Promise.all(
          liveOrders.map((live) =>
            applyShopifyOrderUpdate(live, { upsert: false }),
          ),
        );
        orders = await Order.find(query).sort({ createdAt: -1 }).lean();
      }
    } catch (syncErr) {
      console.error("Failed to refresh orders from Shopify:", syncErr);
    }

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
