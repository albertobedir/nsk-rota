"use client";
import { useState } from "react";

type Order = {
  orderNo: string;
  invoiceNo?: string;
  b2bNo?: string;
  packing?: boolean;
  orderDate: string;
  total: string;
  tracking?: string;
  warehouse?: string;
  deliveryAddress?: string;
};

const FAKE_ORDERS: Order[] = [
  {
    orderNo: "0060005262",
    invoiceNo: "",
    b2bNo: "-",
    packing: true,
    orderDate: "2025-12-17",
    total: "€55,059.20",
    tracking: "TRK-001",
    warehouse: "WH-A",
    deliveryAddress: "Istanbul, Turkey",
  },
  {
    orderNo: "1010084927",
    invoiceNo: "9010003589",
    b2bNo: "-",
    packing: true,
    orderDate: "2025-12-05",
    total: "€1,829.00",
    tracking: "TRK-002",
    warehouse: "WH-B",
    deliveryAddress: "Ankara, Turkey",
  },
  {
    orderNo: "1010080387",
    invoiceNo: "",
    b2bNo: "-",
    packing: false,
    orderDate: "2025-11-13",
    total: "€0.00",
    tracking: "",
    warehouse: "",
    deliveryAddress: "",
  },
];

export default function OrderHistoryPage() {
  const [orderNo, setOrderNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const clearFilters = () => {
    setOrderNo("");
    setInvoiceNo("");
    setTrackingNo("");
  };

  // static filter applied client-side for demo
  const rows = FAKE_ORDERS.filter((o) => {
    if (orderNo && !o.orderNo.includes(orderNo)) return false;
    if (invoiceNo && !(o.invoiceNo || "").includes(invoiceNo)) return false;
    if (trackingNo && !(o.tracking || "").includes(trackingNo)) return false;
    return true;
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Order History</h2>

      {/* Header card with orange theme and CTA */}

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
              onClick={() => {}}
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
                key={r.orderNo}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="px-6 py-4 text-sm text-slate-800">
                  {r.orderNo}
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
      </div>
    </div>
  );
}
