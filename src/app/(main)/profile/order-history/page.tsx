"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";
import Link from "next/link";

type Order = {
  orderNo: string;
  id?: string;
  orderDate: string;
  total: string;
  tracking?: string;
  trackingUrl?: string;
  warehouse?: string;
  deliveryAddress?: string;
};

export default function OrderHistoryPage() {
  const [orderNo, setOrderNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useSessionStore((s) => s.user);

  const clearFilters = () => {
    setOrderNo("");
    setTrackingNo("");
  };

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setOrders([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/orders?customerId=${encodeURIComponent(user.id)}`,
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
          // Hide cancelled draft orders (credit-card-payment tag)
          // These are duplicates from the checkout flow and should not be shown
          const tags: string[] = o.tags ?? [];
          const isCancelled =
            o.financialStatus === "voided" || o.cancelledAt != null;

          if (isCancelled && tags.includes("credit-card-payment")) {
            return false; // Hide this order
          }
          return true; // Show this order
        })
        .map((o: any) => {
          const orderNo = o.name || o.order_number || o.id || "";
          // Extract numeric ID from full GID (e.g., "gid://shopify/Order/6614677946439" → "6614677946439")
          const fullId = o.shopifyId || o.id || "";
          const id = fullId.includes("/")
            ? fullId.split("/").pop() || fullId
            : fullId;
          const orderDate = o.createdAt || o.raw?.created_at || "";
          const total = o.raw?.total_price
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

          const fulfillments: any[] = Array.isArray(o.raw?.fulfillments)
            ? o.raw.fulfillments
            : [];

          const trackingNumbers = fulfillments
            .map((f: any) => f.tracking_number)
            .filter(Boolean)
            .join(", ");

          const trackingUrl: string =
            fulfillments.find((f: any) => f.tracking_url)?.tracking_url || "";

          const trackingCompany: string =
            fulfillments.find((f: any) => f.tracking_company)
              ?.tracking_company || "";

          return {
            id,
            orderNo,
            orderDate: orderDate?.slice?.(0, 10) || orderDate,
            total,
            tracking: (o.tracking || trackingNumbers || "") as string,
            trackingUrl,
            warehouse: trackingCompany || o.warehouse || "",
            deliveryAddress,
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
  }, [user?.id]);

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
                  Order Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Total
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
              {rows.map((r, i) => (
                <tr
                  key={`${r.orderNo ?? r.id ?? ""}-${i}`}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
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
                    {r.orderDate}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {r.total}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.tracking ? (
                      r.trackingUrl ? (
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
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.deliveryAddress || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
