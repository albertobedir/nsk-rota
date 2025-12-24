"use client";
import { useState } from "react";

type Invoice = {
  invoiceNo: string;
  orderNo?: string;
  date: string;
  total: string;
  status?: string;
};

const FAKE_INVOICES: Invoice[] = [
  {
    invoiceNo: "9010003589",
    orderNo: "1010084927",
    date: "2025-12-06",
    total: "€1,829.00",
    status: "Paid",
  },
  {
    invoiceNo: "9010003590",
    orderNo: "1010089999",
    date: "2025-11-20",
    total: "€2,500.00",
    status: "Pending",
  },
  {
    invoiceNo: "9010003600",
    orderNo: "0060005262",
    date: "2025-12-18",
    total: "€55,059.20",
    status: "Paid",
  },
];

export default function InvoicesPage() {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("All");

  const clear = () => {
    setInvoiceNo("");
    setOrderNo("");
    setStartDate("");
    setEndDate("");
    setStatus("All");
  };

  const rows = FAKE_INVOICES.filter((i) => {
    if (invoiceNo && !i.invoiceNo.includes(invoiceNo)) return false;
    if (orderNo && !(i.orderNo || "").includes(orderNo)) return false;
    if (status !== "All" && i.status !== status) return false;
    if (startDate && new Date(i.date) < new Date(startDate)) return false;
    if (endDate && new Date(i.date) > new Date(endDate)) return false;
    return true;
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Invoices</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Ürün KODU / Invoice No
            </label>
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
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
              Fatura Tarihi
            </label>
            <div className="mt-2 flex items-center gap-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 shrink-0 rounded border px-3 py-2 text-sm"
              />
              <span className="opacity-60">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 shrink-0 rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-3">
            <button
              type="button"
              className="inline-flex items-center rounded bg-amber-500 px-6 py-2 text-white"
            >
              Search
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded bg-white border border-slate-300 px-6 py-2 text-slate-700"
              onClick={clear}
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
                Invoice No
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Order No
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Date
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Total
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.invoiceNo}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="px-6 py-4 text-sm text-slate-800">
                  {r.invoiceNo}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {r.orderNo}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{r.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {r.total}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
