"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";
import Link from "next/link";

type Order = {
  orderNo: string;
  id?: string;
  invoiceNo?: string;
  b2bNo?: string;
  packing?: boolean;
  orderDate: string;
  total: string;
  tracking?: string;
  warehouse?: string;
  deliveryAddress?: string;
};

export default function OrderHistoryPage() {
  const [orderNo, setOrderNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useSessionStore((s) => s.user);

  const clearFilters = () => {
    setOrderNo("");
    setInvoiceNo("");
    setTrackingNo("");
  };

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (user?.email) headers["x-user-email"] = user.email;
      const res = await fetch("/api/orders", { headers });
      if (res.status === 401) {
        setOrders([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error || "Failed to fetch orders");
        setOrders([]);
        setLoading(false);
        return;
      }

      const mapped: Order[] = (data.orders || []).map((o: any) => {
        const orderNo = o.name || o.order_number || o.id || "";
        const id = o.id || "";
        const orderDate = o.createdAt || o.created_at || "";
        const total = o.totalPriceSet?.shopMoney
          ? `${o.totalPriceSet.shopMoney.amount} ${o.totalPriceSet.shopMoney.currencyCode}`
          : o.total_price || "";
        const shipping = o.shippingAddress || o.shipping_address;
        const deliveryAddress = shipping
          ? `${shipping.address1 || ""}${
              shipping.city ? ", " + shipping.city : ""
            }${shipping.zip ? " " + shipping.zip : ""}${
              shipping.country ? ", " + shipping.country : ""
            }`.trim()
          : "";

        return {
          id,
          orderNo,
          orderDate: orderDate?.slice?.(0, 10) || orderDate,
          total,
          tracking: (o.tracking || o.fulfillments || "") as string,
          warehouse: o.warehouse || "",
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
  }, [user?.email]);

  const rows = orders.filter((o) => {
    if (orderNo && !o.orderNo.includes(orderNo)) return false;
    if (invoiceNo && !(o.invoiceNo || "").includes(invoiceNo)) return false;
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
            <label className="block text-xs text-slate-600">Invoice No</label>
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
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
                  Invoice No
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  B2B No
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Packing
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
                  Warehouse
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Delivery Address
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={(r.orderNo || r.id) + i}
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
                    {r.invoiceNo || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.b2bNo || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.packing ? (
                      <span className="text-amber-600">Yes</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.orderDate}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {r.total}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.tracking || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.warehouse || "-"}
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
