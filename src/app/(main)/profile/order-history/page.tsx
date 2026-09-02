"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";
import Link from "next/link";
import { getOrderStatusInfo, type OrderStatusInfo } from "@/lib/orders/status";
import {
  FulfillmentStatusBadge,
  PaymentStatusBadges,
} from "@/components/orders/order-status";

type Order = {
  orderNo: string;
  id?: string;
  poNumber?: string | null;
  orderDate: string;
  total: string;
  tracking?: string;
  trackingUrl?: string;
  warehouse?: string;
  deliveryAddress?: string;
  cancelled?: boolean;
  cancelReason?: string | null;
  status?: string;
  statusInfo: OrderStatusInfo;
};

export default function OrderHistoryPage() {
  const [orderNo, setOrderNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useSessionStore((s) => s.user);
  const customerKey = user?.shopifyCustomerId || user?.id || "";

  const clearFilters = () => {
    setOrderNo("");
    setTrackingNo("");
  };

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      if (!customerKey) {
        setOrders([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/orders?customerId=${encodeURIComponent(customerKey)}`,
      );
      if (res.status === 401) {
        setOrders([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }
      const data = await res.json();

      // 🔍 DEBUG: Log API response
      console.log("📦 API response:", data);
      console.log("Orders array:", data.orders);
      console.log("Orders count:", data.orders?.length);

      if (!data?.ok) {
        setError(data?.error || "Failed to fetch orders");
        setOrders([]);
        setLoading(false);
        return;
      }

      const mapped: Order[] = (data.orders || [])
        .filter((o: any) => {
          // Hide cancelled checkout duplicates tagged as credit-card-payment.
          // Real cancelled orders from Shopify admin should still be visible.
          const tags: string[] = Array.isArray(o.tags) ? o.tags : [];
          const isCancelled = Boolean(o.cancelled || o.cancelledAt);

          if (isCancelled && tags.includes("credit-card-payment")) {
            return false;
          }
          return true;
        })
        .map((o: any) => {
          const orderNo = o.name || o.order_number || o.id || "";
          // Extract numeric ID from full GID (e.g., "gid://shopify/Order/6614677946439" → "6614677946439")
          const fullId = o.shopifyId || o.id || "";
          const id = fullId.includes("/")
            ? fullId.split("/").pop() || fullId
            : fullId;
          const orderDate = o.createdAt || o.raw?.created_at || "";
          const total = o.totalPrice?.amount
            ? `${o.totalPrice.amount} ${o.totalPrice.currencyCode || o.raw?.currency || "USD"}`
            : o.raw?.total_price
              ? `${o.raw.total_price} ${o.raw.currency || "USD"}`
              : "";
          const shipping = o.shippingAddress || o.shipping_address;
          const deliveryAddress = shipping
            ? `${shipping.address1 || ""}${
                shipping.city ? ", " + shipping.city : ""
              }${shipping.zip ? " " + shipping.zip : ""}${
                shipping.country ? ", " + shipping.country : ""
              }`.trim()
            : "";

          const statusInfo = getOrderStatusInfo(o);
          const trackingNumbers = statusInfo.trackings
            .map((t) => t.number)
            .filter(Boolean)
            .join(", ");
          const trackingUrl =
            statusInfo.trackings.find((t) => t.url)?.url ||
            o.trackingUrl ||
            "";
          const trackingCompany =
            statusInfo.trackings.find((t) => t.company)?.company ||
            o.trackingCompany ||
            o.warehouse ||
            "";

          return {
            id,
            orderNo,
            poNumber: o.poNumber || o.raw?.po_number || null,
            orderDate: orderDate?.slice?.(0, 10) || orderDate,
            total,
            tracking: (o.tracking || trackingNumbers || "") as string,
            trackingUrl,
            warehouse: trackingCompany,
            deliveryAddress,
            cancelled: statusInfo.cancelled,
            cancelReason: statusInfo.cancelReason,
            status: o.status || (statusInfo.cancelled ? "Cancelled" : "-"),
            statusInfo,
          } as Order;
        });

      setOrders(mapped);
    } catch (err: any) {
      setError(err?.message || "An error occurred");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerKey]);

  const rows = orders.filter((o) => {
    if (orderNo && !o.orderNo.includes(orderNo)) return false;
    if (trackingNo && !(o.tracking || "").includes(trackingNo)) return false;
    return true;
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Order History</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="md:col-span-1 lg:col-span-1">
            <label className="block text-xs text-slate-600">Order No</label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-1 lg:col-span-1">
            <label className="block text-xs text-slate-600">Tracking No</label>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-3">
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex items-center rounded bg-amber-500 px-4 py-2 text-white"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center rounded border border-slate-200 bg-white px-4 py-2 text-slate-800"
            >
              Clear Filters
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6">Loading…</div>
        ) : error ? (
          <div className="p-6 text-amber-600">{error}</div>
        ) : (
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-amber-500 text-white">
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Order No
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  PO Number
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Order Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Payment
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Shipment
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Tracking
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Delivery Address
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                <tr
                  key={`${r.orderNo ?? r.id ?? ""}-${i}`}
                  className={
                    r.cancelled
                      ? "bg-red-50"
                      : i % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50"
                  }
                >
                  <td className="px-6 py-4 text-sm text-slate-800">
                    {r.id ? (
                      <Link
                        href={`/profile/orders/${encodeURIComponent(r.id)}`}
                        className="text-blue-600 underline"
                      >
                        {r.orderNo}
                      </Link>
                    ) : (
                      r.orderNo
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.poNumber || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.orderDate}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {r.total}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <PaymentStatusBadges info={r.statusInfo} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <FulfillmentStatusBadge info={r.statusInfo} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.tracking ? (
                      <div className="flex flex-col gap-1">
                        {r.trackingUrl ? (
                          <a
                            href={r.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            {r.tracking}
                          </a>
                        ) : (
                          r.tracking
                        )}
                        {r.warehouse ? (
                          <span className="text-xs text-slate-500">
                            {r.warehouse}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.deliveryAddress || "-"}
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
