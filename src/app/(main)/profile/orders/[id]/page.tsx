/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

type LineItem = {
  title: string;
  quantity: number;
  image?: string;
  price?: string;
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/orders/${encodeURIComponent(id as string)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) {
          setError(d?.error || "Failed to load order");
          setOrder(null);
          return;
        }

        const src = d.data?.data?.node || null;
        if (!src) {
          setOrder(null);
          return;
        }

        const raw = (src.raw || {}) as any;

        // Normalize line items: convert raw.line_items -> { edges: [{ node: {...} }] }
        const lineItemsEdges = ((): any[] => {
          if (src.lineItems?.edges) return src.lineItems.edges;
          const arr = raw.line_items || raw.lineItems || [];
          return arr.map((li: any) => ({
            node: {
              title: li.title || li.name,
              quantity: li.quantity ?? li.current_quantity ?? 1,
              variant: {
                image: { url: li.image?.src || li.image?.url || null },
                price: {
                  amount: li.price || li.price_set?.shop_money?.amount || null,
                  currencyCode:
                    raw.currency || raw.presentment_currency || null,
                },
              },
            },
          }));
        })();

        const normalized = {
          id: src._id?.toString?.() || src.id || src.shopifyId || raw.id,
          orderNumber:
            src.orderNumber || src.order_number || raw.order_number || src.name,
          processedAt: src.processedAt || raw.processed_at || src.createdAt,
          financialStatus: src.financialStatus || raw.financial_status,
          fulfillmentStatus: src.fulfillmentStatus || raw.fulfillment_status,
          totalPrice: {
            amount:
              src.totalPrice?.amount ||
              raw.total_price ||
              raw.current_total_price ||
              null,
            currencyCode:
              src.totalPrice?.currencyCode ||
              raw.currency ||
              raw.presentment_currency ||
              null,
          },
          shippingAddress:
            src.shippingAddress ||
            (raw.shipping_address
              ? {
                  address1: raw.shipping_address.address1 || "",
                  city:
                    raw.shipping_address.city ||
                    raw.shipping_address.province ||
                    "",
                  zip: raw.shipping_address.zip || "",
                  country:
                    raw.shipping_address.country ||
                    raw.shipping_address.country_name ||
                    "",
                }
              : null),
          billingAddress:
            src.billingAddress ||
            (raw.billing_address
              ? {
                  address1: raw.billing_address.address1 || "",
                  city:
                    raw.billing_address.city ||
                    raw.billing_address.province ||
                    "",
                  zip: raw.billing_address.zip || "",
                  country:
                    raw.billing_address.country ||
                    raw.billing_address.country_name ||
                    "",
                }
              : null),
          lineItems: { edges: lineItemsEdges },
        } as any;

        setOrder(normalized);
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return <div className="p-6">Missing order id</div>;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/profile/open-orders")}
          className="text-sm text-secondary hover:underline"
        >
          ← Back to orders
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Order Detail</h2>
          <button
            type="button"
            onClick={async () => {
              const o = order;
              if (!o) return;

              // build HTML node for rendering
              const itemsHtml = (o.lineItems?.edges || [])
                .map((e: any) => {
                  const n = e.node;
                  const price = n.variant?.price?.amount
                    ? `${n.variant.price.amount} ${n.variant.price.currencyCode}`
                    : "";
                  return `<tr><td style=\"padding:8px 0\">${n.title}</td><td style=\"padding:8px 0; text-align:right\">${n.quantity}</td><td style=\"padding:8px 0; text-align:right\">${price}</td></tr>`;
                })
                .join("");

              const shipping = o.shippingAddress
                ? `${o.shippingAddress.address1 || ""}${o.shippingAddress.city ? ", " + o.shippingAddress.city : ""}${o.shippingAddress.zip ? " " + o.shippingAddress.zip : ""}${o.shippingAddress.country ? ", " + o.shippingAddress.country : ""}`
                : "-";

              const billing = o.billingAddress || shipping;

              const total = o.totalPrice?.amount
                ? `${o.totalPrice.amount} ${o.totalPrice.currencyCode}`
                : "-";

              const html = `
                <div style=\"font-family: Arial, Helvetica, sans-serif; color:#222; padding:24px; width:800px; background:#fff\">
                  <div style=\"display:flex; justify-content:space-between; align-items:center\">
                    <div style=\"font-weight:700; font-size:20px\">${location.hostname || "Store"}</div>
                    <div style=\"color:#666\">ORDER ${o.orderNumber || o.id}</div>
                  </div>
                  <div style=\"font-size:20px; margin-top:18px; font-weight:700\">Thank you for your purchase!</div>
                  <p style=\"color:#666\">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
                  <div style=\"max-width:480px\">
                    <h3>Order summary</h3>
                    <table style=\"width:100%; border-collapse:collapse; margin-top:8px\">
                      <thead>
                        <tr><th style=\"text-align:left; padding:8px 0\">Item</th><th style=\"text-align:right; padding:8px 0\">Qty</th><th style=\"text-align:right; padding:8px 0\">Price</th></tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>
                    <div style=\"margin-top:12px; text-align:right;\">
                      <div style=\"color:#666\">Total</div>
                      <div style=\"font-weight:700; font-size:18px\">${total}</div>
                    </div>
                  </div>
                  <div style=\"display:flex; gap:40px; margin-top:24px\">
                    <div style=\"vertical-align:top\">
                      <h4>Shipping address</h4>
                      <div style=\"color:#666\">${shipping}</div>
                    </div>
                    <div style=\"vertical-align:top\">
                      <h4>Billing address</h4>
                      <div style=\"color:#666\">${billing}</div>
                    </div>
                  </div>
                </div>
              `;

              try {
                const node = document.createElement("div");
                node.style.position = "fixed";
                node.style.left = "-9999px";
                node.style.top = "0";
                node.innerHTML = html;
                document.body.appendChild(node);

                const html2canvas = (await import("html2canvas")).default;
                const { jsPDF } = await import("jspdf");

                const canvas = await html2canvas(node, {
                  scale: 2,
                  useCORS: true,
                });
                const imgData = canvas.toDataURL("image/png");

                const pdf = new jsPDF({
                  unit: "pt",
                  format: "a4",
                  orientation: "portrait",
                });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const imgProps: any = pdf.getImageProperties(imgData);
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
                pdf.save(`order-${o.orderNumber || o.id}.pdf`);
                document.body.removeChild(node);
              } catch (e) {
                console.error("pdf error", e);
              }
            }}
            className="text-sm bg-secondary text-white px-3 py-2 rounded"
          >
            Download PDF
          </button>
        </div>
      </div>
      {loading ? (
        <div className="min-h-[20vh] flex items-center justify-center">
          <Spinner label="Loading order..." />
        </div>
      ) : error ? (
        <div className="p-6 text-amber-600">{error}</div>
      ) : !order ? (
        <div className="p-6">No order found</div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-slate-600">Order No</div>
              <div className="font-medium">{order.orderNumber || order.id}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Date</div>
              <div className="font-medium">
                {(order.processedAt || "").slice(0, 10)}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Status</div>
              <div className="font-medium">
                {order.financialStatus || order.fulfillmentStatus || "-"}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Total</div>
              <div className="font-medium">
                {order.totalPrice?.amount
                  ? `${order.totalPrice.amount} ${order.totalPrice.currencyCode}`
                  : "-"}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Shipping Address</h3>
            <div className="text-sm text-slate-700">
              {order.shippingAddress ? (
                <div>
                  {order.shippingAddress.address1}
                  {order.shippingAddress.city
                    ? ", " + order.shippingAddress.city
                    : ""}
                  {order.shippingAddress.zip
                    ? " " + order.shippingAddress.zip
                    : ""}
                  {order.shippingAddress.country
                    ? ", " + order.shippingAddress.country
                    : ""}
                </div>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Items</h3>
            <div className="divide-y">
              {(order.lineItems?.edges || []).map((e: any, idx: number) => {
                const node = e.node;
                return (
                  <div key={idx} className="py-3 flex items-center gap-4">
                    {node.variant?.image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={node.variant.image.url}
                        alt={node.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div>
                      <div className="font-medium">{node.title}</div>
                      <div className="text-sm text-slate-600">
                        Qty: {node.quantity}
                      </div>
                      {node.variant?.price?.amount && (
                        <div className="text-sm">
                          {node.variant.price.amount}{" "}
                          {node.variant.price.currencyCode}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
