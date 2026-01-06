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
        <h2 className="text-xl font-semibold">Order Detail</h2>
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
