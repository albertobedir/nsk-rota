"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import useSessionStore from "@/store/session-store";
import Link from "next/link";
import { extractNumericId } from "@/lib/shopify/ids";
import { getOrderStatusInfo, type OrderStatusInfo } from "@/lib/orders/status";
import {
  FulfillmentStatusBadge,
  PaymentStatusBadges,
} from "@/components/orders/order-status";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  poNumber?: string | null;
  invoiceDate: string;
  total: string;
  deliveryAddress?: string;
  cancelled?: boolean;
  statusInfo: OrderStatusInfo;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatAddress(addr: any) {
  if (!addr) return "";
  return `${addr.address1 || ""}${addr.city ? ", " + addr.city : ""}${
    addr.zip ? " " + addr.zip : ""
  }${addr.country ? ", " + addr.country : ""}`.trim();
}

export default function InvoicesPage() {
  const [orderNo, setOrderNo] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useSessionStore((s) => s.user);
  const customerKey = user?.shopifyCustomerId || user?.id || "";

  const clearFilters = () => {
    setOrderNo("");
  };

  async function fetchInvoices() {
    setLoading(true);
    setError(null);
    try {
      if (!customerKey) {
        setInvoices([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/invoices?customerId=${encodeURIComponent(customerKey)}`,
      );
      if (res.status === 401) {
        setInvoices([]);
        setError("Not logged in or missing customer info.");
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (!data?.ok) {
        setError(data?.error || "Failed to fetch invoices");
        setInvoices([]);
        setLoading(false);
        return;
      }

      const mapped: InvoiceRow[] = (data.invoices || [])
        .filter((inv: any) => {
          const tags: string[] = Array.isArray(inv.tags) ? inv.tags : [];
          const isCancelled = Boolean(inv.cancelledAt);
          if (isCancelled && tags.includes("credit-card-payment")) return false;
          return true;
        })
        .map((inv: any) => {
          const id =
            extractNumericId(inv.orderId) ||
            String(inv.orderId || inv.invoiceNumber || "");
          const total = inv.grandTotal
            ? `${inv.grandTotal} ${inv.currency || "USD"}`
            : "";
          const statusSource = inv.raw || inv;

          return {
            id,
            invoiceNumber: inv.invoiceNumber || `#${inv.orderNumber || id}`,
            poNumber: inv.poNumber || null,
            invoiceDate: formatDate(inv.invoiceDate),
            total,
            deliveryAddress: formatAddress(inv.shippingAddress),
            cancelled: Boolean(inv.cancelledAt),
            statusInfo: getOrderStatusInfo(statusSource),
          } as InvoiceRow;
        });

      setInvoices(mapped);
    } catch (err: any) {
      setError(err?.message || "An error occurred");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerKey]);

  const rows = invoices.filter((inv) => {
    if (!orderNo) return true;
    const q = orderNo.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.poNumber || "").toLowerCase().includes(q)
    );
  });

  const downloadPdf = (id: string) => {
    const params = new URLSearchParams();
    params.append("id", id);
    if (customerKey) params.append("customerId", customerKey);
    window.open(`/api/pdf?${params.toString()}`);
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <h2 className="text-xl font-semibold">Invoices</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="md:col-span-1 lg:col-span-2">
            <label className="block text-xs text-slate-600">
              Invoice / Order / PO No
            </label>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-3">
            <button
              type="button"
              onClick={fetchInvoices}
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
                  Invoice No
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  PO Number
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  Date
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
                  Delivery Address
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold">
                  PDF
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
                    No invoices found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={`${r.invoiceNumber}-${r.id}-${i}`}
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
                          {r.invoiceNumber}
                        </Link>
                      ) : (
                        r.invoiceNumber
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {r.poNumber || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {r.invoiceDate}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {r.total || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <PaymentStatusBadges info={r.statusInfo} />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <FulfillmentStatusBadge info={r.statusInfo} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {r.deliveryAddress || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {r.id ? (
                        <button
                          type="button"
                          onClick={() => downloadPdf(r.id)}
                          className="text-blue-600 underline"
                        >
                          Download
                        </button>
                      ) : (
                        "—"
                      )}
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
