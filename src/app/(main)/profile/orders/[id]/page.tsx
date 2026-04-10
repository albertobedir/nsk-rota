/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import useSessionStore from "@/store/session-store";

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
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [userDiscount, setUserDiscount] = useState<number | null>(null);

  // Get user tier from session store
  const tierTag = useSessionStore((s) => s.tierTag);
  const getDiscountForTier = useSessionStore((s) => s.getDiscountForTier);
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          console.log("\n=== 📦 LINE ITEMS DEBUG (Frontend) ===");
          console.log("src.lineItems:", JSON.stringify(src.lineItems, null, 2));
          console.log("raw.lineItems:", JSON.stringify(raw.lineItems, null, 2));
          console.log(
            "raw.line_items:",
            JSON.stringify(raw.line_items, null, 2),
          );
          console.log("typeof raw.line_items:", typeof raw.line_items);
          console.log(
            "Array.isArray(raw.line_items):",
            Array.isArray(raw.line_items),
          );
          console.log("=== END DEBUG ===\n");

          // GraphQL formatı (Mongo'dan gelen yeni kayıtlar)
          if (src.lineItems?.edges) {
            return src.lineItems.edges.map((e: any) => {
              const node = e.node;
              const originalPrice = Number(
                node.originalUnitPriceSet?.shopMoney?.amount || 0,
              );
              const discountedPrice = Number(
                node.discountedUnitPriceSet?.shopMoney?.amount || originalPrice,
              );
              const currencyCode =
                node.originalUnitPriceSet?.shopMoney?.currencyCode || "USD";
              const discountDescription =
                node.discountAllocations?.[0]?.discountApplication
                  ?.description ||
                node.discountAllocations?.[0]?.discountApplication?.title ||
                null;

              return {
                node: {
                  ...node,
                  originalUnitPrice: originalPrice,
                  discountedUnitPrice: discountedPrice,
                  discountDescription,
                  variant: {
                    ...node.variant,
                    price: {
                      amount: String(originalPrice),
                      currencyCode,
                    },
                  },
                },
              };
            });
          }

          // raw içinde GraphQL formatı
          if (raw.lineItems?.edges) {
            return raw.lineItems.edges.map((e: any) => {
              const node = e.node;
              const originalPrice = Number(
                node.originalUnitPriceSet?.shopMoney?.amount || 0,
              );
              const discountedPrice = Number(
                node.discountedUnitPriceSet?.shopMoney?.amount || originalPrice,
              );
              const currencyCode =
                node.originalUnitPriceSet?.shopMoney?.currencyCode ||
                raw.currency ||
                "USD";
              const discountDescription =
                node.discountAllocations?.[0]?.discountApplication
                  ?.description ||
                node.discountAllocations?.[0]?.discountApplication?.title ||
                null;

              return {
                node: {
                  ...node,
                  originalUnitPrice: originalPrice,
                  discountedUnitPrice: discountedPrice,
                  discountDescription,
                  variant: {
                    ...node.variant,
                    price: {
                      amount: String(originalPrice),
                      currencyCode,
                    },
                  },
                },
              };
            });
          }

          // REST formatı (eski kayıtlar)
          const arr = Array.isArray(raw.line_items)
            ? raw.line_items
            : Array.isArray(raw.lineItems)
              ? raw.lineItems
              : [];

          const discountApplications: any[] = raw.discount_applications || [];

          // Safety check
          if (!Array.isArray(arr)) {
            console.warn("line_items is not an array, returning empty");
            return [];
          }

          return arr.map((li: any) => {
            // GraphQL formatı
            const originalPrice = Number(
              li.originalUnitPriceSet?.shopMoney?.amount || li.price || 0,
            );
            const discountedPrice = Number(
              li.discountedUnitPriceSet?.shopMoney?.amount || originalPrice,
            );
            const currencyCode =
              li.originalUnitPriceSet?.shopMoney?.currencyCode ||
              raw.currency ||
              "USD";

            const discountDescription =
              li.discountAllocations?.[0]?.discountApplication?.description ||
              li.discountAllocations?.[0]?.discountApplication?.title ||
              ((): string | null => {
                const allocation = li.discount_allocations?.[0];
                const appIndex = allocation?.discount_application_index ?? null;
                const discountApp =
                  appIndex != null ? discountApplications[appIndex] : null;
                return discountApp?.description ?? discountApp?.title ?? null;
              })() ||
              null;

            return {
              node: {
                title: li.title || li.name,
                quantity: li.quantity ?? 1,
                productId: li.product_id ?? null,
                originalUnitPrice: originalPrice,
                discountedUnitPrice: discountedPrice,
                discountDescription,
                discountValue:
                  li.discountAllocations?.[0]?.allocatedAmountSet?.shopMoney
                    ?.amount ?? null,
                variant: {
                  image: {
                    url: li.variant?.image?.url || li.image?.src || null,
                  },
                  price: {
                    amount: String(originalPrice),
                    currencyCode,
                  },
                },
              },
            };
          });
        })();

        const normalized = {
          id: src._id?.toString?.() || src.id || src.shopifyId || raw.id,
          shopifyId: src.shopifyId || raw.id, // Shopify numeric ID
          orderNumber:
            src.orderNumber || src.order_number || raw.order_number || src.name,
          processedAt: src.processedAt || raw.processed_at || src.createdAt,
          financialStatus:
            src.financialStatus ||
            raw.displayFinancialStatus ||
            raw.financial_status,
          fulfillmentStatus:
            src.fulfillmentStatus ||
            raw.displayFulfillmentStatus ||
            raw.fulfillment_status,
          totalPrice: {
            amount:
              src.totalPriceSet?.shopMoney?.amount ||
              raw.totalPriceSet?.shopMoney?.amount ||
              src.totalPrice?.amount ||
              raw.total_price ||
              raw.current_total_price ||
              null,
            currencyCode:
              src.totalPriceSet?.shopMoney?.currencyCode ||
              raw.totalPriceSet?.shopMoney?.currencyCode ||
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
          paymentCollectionUrl: src.paymentCollectionUrl || undefined,
          trackings: (() => {
            const fulfillments: any[] = raw.fulfillments || [];
            return fulfillments.flatMap((f: any) => {
              // GraphQL formatı
              if (f.trackingInfo) {
                return (f.trackingInfo || []).map((t: any) => ({
                  company: t.company || f.trackingCompany || null,
                  number: t.number || null,
                  url: t.url || null,
                }));
              }
              // REST formatı (eski kayıtlar)
              return (f.tracking_numbers || [f.tracking_number])
                .filter(Boolean)
                .map((_: string, i: number) => ({
                  company: f.tracking_company || null,
                  number:
                    (f.tracking_numbers || [f.tracking_number])[i] || null,
                  url:
                    (f.tracking_urls || [f.tracking_url])[i] ||
                    f.tracking_url ||
                    null,
                }));
            });
          })(),
        } as any;

        setOrder(normalized);
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!order) return;
    console.log("[order-detail] fetched order:", order);
  }, [order]);

  // Handle Pay Order button click - redirect to payment collection URL
  const handlePayOrder = async () => {
    if (!order?.paymentCollectionUrl) {
      toast.error("Payment URL not available for this order.");
      return;
    }

    // Only pending orders can be paid
    if (order.financialStatus?.toLowerCase() !== "pending") {
      toast.info("This order has already been paid.");
      return;
    }

    // Redirect to payment collection URL
    window.open(order.paymentCollectionUrl, "_blank");
  };

  // Fetch pricing tiers and calculate user discount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`/api/pricing-tiers/db`);
        const json = await resp.json().catch(() => null);
        const tiers: any[] = json?.results || [];
        setPricingTiers(tiers);

        // Calculate discount for current tier
        if (tierTag) {
          const normalized = String(tierTag).toLowerCase().trim();
          const found = tiers.find(
            (t) =>
              String(t.tierTag ?? "")
                .toLowerCase()
                .trim() === normalized,
          );
          const discount = found ? Number(found.discountPercentage) : null;
          setUserDiscount(discount);
        }
      } catch (e) {
        console.warn("[order-detail] pricing tiers fetch failed", e);
      }
    })();
  }, [tierTag]);

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
          onClick={() => router.push("/profile/order-history")}
          className="text-sm text-secondary hover:underline"
        >
          ← Back to orders
        </button>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="text-xs text-slate-500">Order Details</div>
            <h2 className="text-lg font-semibold">
              {loading ? "Loading..." : order?.orderNumber || "Order"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              // Extract numeric ID from full GID if present
              const numericId = (id as string).includes("/")
                ? (id as string).split("/").pop() || (id as string)
                : (id as string);
              params.append("id", numericId as string);
              if (user?.id) {
                params.append("customerId", user.id);
              }
              if (userDiscount) {
                params.append("discount", String(userDiscount));
              }
              window.open(`/api/pdf?${params.toString()}`);
            }}
            className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded"
          >
            Download as PDF
          </button>
          <button
            type="button"
            onClick={handlePayOrder}
            disabled={
              !order || order.financialStatus?.toLowerCase() !== "pending"
            }
            className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:brightness-110 transition"
          >
            Pay Order
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
            <h3 className="text-lg font-semibold">Billing Address</h3>
            <div className="text-sm text-slate-700">
              {order.billingAddress ? (
                <div>
                  {order.billingAddress.address1}
                  {order.billingAddress.city
                    ? ", " + order.billingAddress.city
                    : ""}
                  {order.billingAddress.zip
                    ? " " + order.billingAddress.zip
                    : ""}
                  {order.billingAddress.country
                    ? ", " + order.billingAddress.country
                    : ""}
                </div>
              ) : (
                "-"
              )}
            </div>
          </div>

          {order.trackings?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Shipment Tracking</h3>
              <div className="mt-2 space-y-2">
                {order.trackings.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {t.company && (
                      <span className="font-medium text-slate-700">
                        {t.company}
                      </span>
                    )}
                    {t.number && (
                      <span className="font-mono text-sm text-slate-600">
                        {t.number}
                      </span>
                    )}
                    {t.url ? (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 rounded bg-secondary px-3 py-1 text-sm font-semibold text-white hover:brightness-110 transition"
                      >
                        Track My Shipment
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        {(node.title ?? "")
                          .replace(/\s*-\s*[\w\d]+$/, "")
                          .trim() || node.title}
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
                      {(node.originalUnitPriceSet?.shopMoney?.amount ||
                        node.variant?.price?.amount) &&
                        (() => {
                          const originalAmt = Number(
                            node.originalUnitPriceSet?.shopMoney?.amount ||
                              node.variant?.price?.amount ||
                              0,
                          );
                          const discountedAmt = Number(
                            node.discountedUnitPriceSet?.shopMoney?.amount ||
                              node.discountedUnitPrice ||
                              originalAmt,
                          );
                          const currencyCode =
                            node.originalUnitPriceSet?.shopMoney
                              ?.currencyCode ||
                            node.variant?.price?.currencyCode ||
                            "USD";
                          const hasDiscount =
                            discountedAmt != null &&
                            discountedAmt < originalAmt;

                          return (
                            <div className="flex flex-col gap-0.5">
                              {hasDiscount ? (
                                <>
                                  <span className="text-sm text-gray-400 line-through">
                                    ${originalAmt.toFixed(2)} {currencyCode}
                                  </span>
                                  <span className="text-sm font-semibold text-secondary">
                                    ${discountedAmt.toFixed(2)} {currencyCode}
                                  </span>
                                  {node.discountDescription && (
                                    <span className="text-xs text-green-600">
                                      {node.discountDescription}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm">
                                  ${originalAmt.toFixed(2)} {currencyCode}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
