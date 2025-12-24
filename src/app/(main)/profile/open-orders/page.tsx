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
  status?: string;
  preparedBy?: string;
  productCode?: string;
  deliveryNote?: string;
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
    status: "Open",
    preparedBy: "All",
    productCode: "29015989",
    deliveryNote: "",
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
    status: "Open",
    preparedBy: "User A",
    productCode: "12345678",
    deliveryNote: "Urgent",
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
    status: "Closed",
    preparedBy: "User B",
    productCode: "",
    deliveryNote: "",
  },
];

export default function OpenOrdersPage() {
  const [productCode, setProductCode] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("Open");
  const [deliveryNote, setDeliveryNote] = useState("");

  const clearFilters = () => {
    setProductCode("");
    setPreparedBy("");
    setOrderNo("");
    setTrackingNo("");
    setStartDate("");
    setEndDate("");
    setStatus("Open");
    setDeliveryNote("");
  };

  const rows = FAKE_ORDERS.filter((o) => {
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
              Ürün Kodu
            </label>
            <input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Hazırlayan
            </label>
            <input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Sipariş Numarası
            </label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Sipariş Takip Numarası
            </label>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Sipariş Durumu
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
              Teslimat Notu
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
              onClick={() => {}}
            >
              Arama
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded bg-amber-500 px-6 py-2 text-white"
              onClick={clearFilters}
            >
              Filtreleri Temizle
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
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Status
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
                <td className="px-6 py-4 text-sm text-slate-700">
                  {r.status || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
