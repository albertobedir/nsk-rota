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

type ProductMeta = {
  shopifyId: string | number;
  rotaNo: string;
  refNo: string;
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  // map of shopify product_id -> ProductMeta
  const [productMetas, setProductMetas] = useState<Record<string, ProductMeta>>(
    {},
  );

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
              productId: li.product_id ?? null,
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

  // Fetch product metadata (rotaNo, refNo, shopifyId) for each line item
  useEffect(() => {
    if (!order) return;
    const edges: any[] = order.lineItems?.edges || [];
    if (edges.length === 0) return;

    // Build lookup entries: prefer product_id, fall back to title
    const lookupEntries: {
      productId: string;
      query: string;
      byTitle: boolean;
    }[] = [];
    const seenIds = new Set<string>();
    for (const e of edges) {
      const node = e.node;
      if (node?.productId) {
        const key = String(node.productId);
        if (!seenIds.has(key)) {
          seenIds.add(key);
          lookupEntries.push({ productId: key, query: key, byTitle: false });
        }
      } else if (node?.title) {
        const key = `title:${node.title}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          lookupEntries.push({
            productId: key,
            query: node.title,
            byTitle: true,
          });
        }
      }
    }

    const extractMeta = (prod: any, productId: string) => {
      const metafields: any[] = prod.raw?.metafields ?? [];
      const oemRaw = metafields.find(
        (m: any) => m.namespace === "custom" && m.key === "oem_info",
      );
      let rotaNo = prod.raw?.variants?.[0]?.sku ?? "";
      let refNo = "";
      if (oemRaw?.value) {
        try {
          const parsed = JSON.parse(oemRaw.value);
          const first = Array.isArray(parsed) ? parsed[0] : parsed;
          if (!rotaNo) rotaNo = first?.RotaNo ?? "";
          refNo = first?.OemNo ?? "";
        } catch {
          // ignore
        }
      }
      return {
        productId,
        shopifyId: prod.shopifyId ?? prod.raw?.id ?? productId,
        rotaNo,
        refNo,
      };
    };

    Promise.all(
      lookupEntries.map(({ productId, query, byTitle }) => {
        const url = byTitle
          ? `/api/products/gets?title=${encodeURIComponent(query)}&limit=1`
          : `/api/products/gets?shopifyId=${query}&limit=1`;
        return fetch(url)
          .then((r) => r.json())
          .then((d) => {
            const prod = d?.results?.[0] ?? null;
            if (!prod) return null;
            return extractMeta(prod, productId);
          })
          .catch(() => null);
      }),
    ).then((results) => {
      const map: Record<string, ProductMeta> = {};
      for (const r of results) {
        if (!r) continue;
        map[String(r.productId)] = {
          shopifyId: r.shopifyId,
          rotaNo: r.rotaNo,
          refNo: r.refNo,
        };
      }
      setProductMetas(map);
    });
  }, [order]);

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
            onClick={() =>
              window.open(`/api/pdf?id=${encodeURIComponent(id as string)}`)
            }
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
          >
            Download as PDF
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
                const metaKey = node.productId
                  ? String(node.productId)
                  : node.title
                    ? `title:${node.title}`
                    : undefined;
                const meta = metaKey ? productMetas[metaKey] : undefined;
                const href = meta ? `/products/${meta.shopifyId}` : undefined;

                const inner = (
                  <div className="py-3 flex items-center gap-4">
                    {node.variant?.image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={node.variant.image.url}
                        alt={node.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium group-hover:underline">
                        {node.title}
                      </div>
                      {meta?.rotaNo && (
                        <div className="text-sm font-semibold text-secondary">
                          Rota No: {meta.rotaNo}
                        </div>
                      )}
                      {meta?.refNo && (
                        <div className="text-sm text-slate-500">
                          Ref: {meta.refNo}
                        </div>
                      )}
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

                return href ? (
                  <a
                    key={idx}
                    href={href}
                    className="group block cursor-pointer hover:bg-slate-50 transition-colors rounded"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={idx}>{inner}</div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
