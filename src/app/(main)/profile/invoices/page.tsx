/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";

type TableRow = {
  invoiceNo: string;
  orderNo: string;
  total: string;
  status?: string;
};

export default function InvoicesPage() {
  const sessionUser = useSessionStore((s) => s.user);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [status, setStatus] = useState("All");

  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setInvoiceNo("");
    setOrderNo("");
    setStatus("All");
  };

  async function fetchInvoices() {
    setError(null);
    const customerId = sessionUser?.customerCode ?? sessionUser?.id ?? null;
    if (!customerId) {
      setError("Giriş yapmalısınız");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("customerId", customerId);
      if (orderNo) params.set("orderId", orderNo);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to load invoices");
        setRows([]);
        return;
      }

      const source = data.invoice ? [data.invoice] : data.invoices || [];

      const mapped: TableRow[] = source.map((inv: any) => ({
        invoiceNo: inv.invoiceNumber || String(inv.orderNumber || "-"),
        orderNo: String(inv.orderNumber || ""),
        total:
          inv.currency && typeof inv.grandTotal === "number"
            ? `${inv.currency} ${inv.grandTotal.toFixed(2)}`
            : String(inv.grandTotal ?? ""),
        status: inv.status || inv.fulfillmentStatus || "",
      }));

      const filtered = mapped.filter((i) => {
        if (invoiceNo && !i.invoiceNo.includes(invoiceNo)) return false;
        if (orderNo && !i.orderNo.includes(orderNo)) return false;
        if (status !== "All" && i.status !== status) return false;
        return true;
      });

      setRows(filtered);
    } catch (e: any) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionUser) fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Invoices</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchInvoices();
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
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

          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded bg-amber-500 px-6 py-2 text-white"
            >
              {loading ? "Loading..." : "Search"}
            </button>

            <button
              type="button"
              className="inline-flex items-center rounded bg-white border border-slate-300 px-6 py-2 text-slate-700"
              onClick={() => {
                clear();
                setRows([]);
              }}
            >
              Filtreleri Temizle
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
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
                key={`${r.invoiceNo}-${i}`}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
              >
                <td className="px-6 py-4 text-sm text-slate-800">
                  {r.invoiceNo}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {r.orderNo}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {r.total}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
