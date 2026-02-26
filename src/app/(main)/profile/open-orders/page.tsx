/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";

type Order = {
  orderNo: string;
  id?: string;
  invoiceNo?: string;
  b2bNo?: string;
  orderDate: string;
  total: string;
  tracking?: string;
  trackingUrl?: string;
  warehouse?: string;
  deliveryAddress?: string;
  status?: string;
  preparedBy?: string;
  productCode?: string;
  deliveryNote?: string;
};

import Link from "next/link";

export default function OpenOrdersPage() {
  const [productCode, setProductCode] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("All");
  const [deliveryNote, setDeliveryNote] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearFilters = () => {
    setProductCode("");
    setPreparedBy("");
    setOrderNo("");
    setTrackingNo("");
    setStartDate("");
    setEndDate("");
    setStatus("All");
    setDeliveryNote("");
  };

  const user = useSessionStore((s) => s.user);

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
        const status =
          o.displayFulfillmentStatus ||
          o.displayFinancialStatus ||
          o.financial_status ||
          "";
        const fulfillments: any[] = Array.isArray(o.fulfillments)
          ? o.fulfillments
          : [];
        const trackingNumbers = fulfillments
          .flatMap((f: any) =>
            f.tracking_numbers?.length
              ? f.tracking_numbers
              : f.tracking_number
                ? [f.tracking_number]
                : [],
          )
          .join(", ");
        const trackingUrl: string =
          fulfillments.find((f: any) => f.tracking_url)?.tracking_url ||
          fulfillments.find((f: any) => f.tracking_urls?.length)
            ?.tracking_urls?.[0] ||
          "";
        return {
          id,
          orderNo,
          orderDate: orderDate?.slice?.(0, 10) || orderDate,
          total,
          tracking: (o.tracking || trackingNumbers || "") as string,
          trackingUrl,
          warehouse: o.warehouse || "",
          deliveryAddress,
          status,
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
  }, []);

  const rows = orders.filter((o) => {
    if (productCode && !(o.productCode || "").includes(productCode))
      return false;
    if (
      preparedBy &&
      !(o.preparedBy || "").toLowerCase().includes(preparedBy.toLowerCase())
    )
      return false;
    if (orderNo && !o.orderNo.includes(orderNo)) return false;
    if (trackingNo && !(o.tracking || "").includes(trackingNo)) return false;
    if (status && status !== "All" && o.status !== status) return false;
    if (
      deliveryNote &&
      !(o.deliveryNote || "").toLowerCase().includes(deliveryNote.toLowerCase())
    )
      return false;
    if (startDate) {
      const sd = new Date(startDate);
      const od = new Date(o.orderDate);
      if (od < sd) return false;
    }
    if (endDate) {
      const ed = new Date(endDate);
      const od = new Date(o.orderDate);
      if (od > ed) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Open Orders</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Product Code
            </label>
            <input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Prepared By
            </label>
            <input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Order Number
            </label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Tracking Number
            </label>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Order Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 w-full max-w-[220px] rounded border px-3 py-2 text-sm ml-4"
            >
              <option>All</option>
              <option>Open</option>
              <option>Closed</option>
              <option>Cancelled</option>
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Delivery Note
            </label>
            <input
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-3">
            <button
              type="button"
              className="inline-flex items-center rounded bg-blue-600 px-6 py-2 text-white"
              onClick={fetchOrders}
            >
              Search
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded bg-amber-500 px-6 py-2 text-white"
              onClick={clearFilters}
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
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.orderNo + i}
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
                    {r.warehouse || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.deliveryAddress || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.status || "-"}
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
