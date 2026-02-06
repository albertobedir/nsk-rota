/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import SingleProdCard from "./single-prod-cart";
import { useEffect, useState } from "react";

type Product = {
  id: string | number;
  code: string;
  title: string;
  price: number;
  image: string;
  oems?: string[];
  location?: string;
  inStock?: boolean;
  stock?: number | string;
  variantId?: string;
  matchType?: "exact" | "partial" | undefined;
  productRaw?: any;
};

export default function MiniPaginationGroup({
  title,
  products,
  pageSize = 5,
  collectionHandle,
  collectionId,
}: {
  title: string;
  products?: Product[];
  pageSize?: number;
  collectionHandle?: string;
  collectionId?: string;
}) {
  const [fetched, setFetched] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);
  const [isCompact, setIsCompact] = useState(false);
  // helper to extract rota number from metafields
  const extractRotaNo = (metafields: any[] = []) => {
    try {
      const direct = metafields.find((m) => m.key === "rota_no")?.value;
      if (direct) return direct;

      const candidate = metafields.find(
        (m) =>
          m.key === "oem_info" ||
          m.key === "brand_info" ||
          (m.namespace === "custom" && /(oem|brand)/i.test(m.key)),
      );

      if (candidate) {
        try {
          const parsed = JSON.parse(candidate.value);
          if (Array.isArray(parsed) && parsed[0]) {
            return (
              parsed[0].RotaNo ||
              parsed[0].rotaNo ||
              parsed[0].Rota ||
              parsed[0].rota ||
              undefined
            );
          }
          if (parsed && typeof parsed === "object") {
            return parsed.RotaNo || parsed.rotaNo || parsed.Rota || parsed.rota;
          }
        } catch (e) {
          const m = String(candidate.value).match(/\d{3,}/);
          if (m) return m[0];
        }
      }

      return undefined;
    } catch (e) {
      return undefined;
    }
  };

  useEffect(() => {
    const mq =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(max-width: 640px)")
        : null;

    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      try {
        setIsCompact(Boolean((e as any).matches));
      } catch (err) {
        setIsCompact(false);
      }
    };

    if (mq) {
      onChange(mq);
      // modern browsers support addEventListener, others use addListener
      if (typeof mq.addEventListener === "function")
        mq.addEventListener("change", onChange as any);
      else if (typeof mq.addListener === "function")
        mq.addListener(onChange as any);
    }
    let mounted = true;

    async function loadAll() {
      try {
        // If a collection handle was provided, fetch that collection and map its products
        if (collectionHandle) {
          const creq = await fetch(
            `/api/collections/gets?handle=${encodeURIComponent(
              collectionHandle,
            )}&page=1&limit=1000`,
          );
          const cjson = await creq.json();
          if (!mounted) return;

          if (cjson?.ok && Array.isArray(cjson.results) && cjson.results[0]) {
            const coll = cjson.results[0];
            const source =
              Array.isArray(coll.productsFull) && coll.productsFull.length > 0
                ? coll.productsFull
                : coll.products || [];

            const mapped: Product[] = source.map((r: any, i: number) => {
              const raw = r.raw ?? {};
              const rotaNo =
                raw?.metafields && Array.isArray(raw.metafields)
                  ? extractRotaNo(raw.metafields)
                  : undefined;
              const codeVal =
                rotaNo ??
                raw?.handle ??
                String(r.shopifyId ?? r.id ?? `p-${i}`);
              const image =
                (raw?.images && raw.images[0] && raw.images[0].src) ||
                raw?.image ||
                "/cr2.jfif";
              const priceStr =
                (r.currentPrice as any) ??
                raw?.variants?.[0]?.price ??
                raw?.variants?.[0]?.price_amount ??
                0;
              const price =
                typeof priceStr === "string"
                  ? parseFloat(priceStr) || 0
                  : Number(priceStr) || 0;

              const oemsArr =
                raw?.metafields && Array.isArray(raw.metafields)
                  ? raw.metafields
                      .filter(
                        (m: any) =>
                          /(oem|brand)/i.test(m.key) ||
                          (m.namespace === "custom" &&
                            /(oem|brand)/i.test(m.key)),
                      )
                      .map((m: any) => m.value)
                  : [];

              const firstVariantId =
                raw?.variants && raw.variants[0] && raw.variants[0].id;

              return {
                id: codeVal,
                code: codeVal,
                title: raw?.title ?? raw?.name ?? r.title ?? `Product ${i + 1}`,
                price,
                image,
                oems: oemsArr,
                productRaw: raw,
                location: "",
                inStock: true,
                stock: 0,
                variantId: firstVariantId
                  ? `gid://shopify/ProductVariant/${firstVariantId}`
                  : undefined,
              } as Product;
            });

            setFetched(mapped);
            return;
          }

          setFetched([]);
          return;
        }

        // fetch many items for now — adjust limit as needed
        const res = await fetch(`/api/products/gets?page=1&limit=10000`);
        const json = await res.json();
        if (!mounted) return;

        if (json?.ok && Array.isArray(json.results)) {
          const extractRotaNo = (metafields: any[] = []) => {
            try {
              const direct = metafields.find((m) => m.key === "rota_no")?.value;
              if (direct) return direct;

              const candidate = metafields.find(
                (m) =>
                  m.key === "oem_info" ||
                  m.key === "brand_info" ||
                  (m.namespace === "custom" && /(oem|brand)/i.test(m.key)),
              );

              if (candidate) {
                try {
                  const parsed = JSON.parse(candidate.value);
                  if (Array.isArray(parsed) && parsed[0]) {
                    return (
                      parsed[0].RotaNo ||
                      parsed[0].rotaNo ||
                      parsed[0].Rota ||
                      parsed[0].rota ||
                      undefined
                    );
                  }
                  if (parsed && typeof parsed === "object") {
                    return (
                      parsed.RotaNo ||
                      parsed.rotaNo ||
                      parsed.Rota ||
                      parsed.rota
                    );
                  }
                } catch (e) {
                  const m = String(candidate.value).match(/\d{3,}/);
                  if (m) return m[0];
                }
              }

              return undefined;
            } catch (e) {
              return undefined;
            }
          };

          const mapped: Product[] = json.results.map((r: any, i: number) => {
            const raw = r.raw ?? {};
            const rotaNo =
              raw?.metafields && Array.isArray(raw.metafields)
                ? extractRotaNo(raw.metafields)
                : undefined;
            const codeVal =
              rotaNo ?? raw?.handle ?? String(r.shopifyId ?? r._id ?? `p-${i}`);
            const image =
              (raw?.images && raw.images[0] && raw.images[0].src) ||
              raw?.image ||
              "/cr2.jfif";
            const priceStr =
              r.currentPrice ??
              raw?.variants?.[0]?.price ??
              raw?.variants?.[0]?.price_amount ??
              0;
            const price =
              typeof priceStr === "string"
                ? parseFloat(priceStr) || 0
                : Number(priceStr) || 0;

            const oemsArr =
              raw?.metafields && Array.isArray(raw.metafields)
                ? raw.metafields
                    .filter(
                      (m: any) =>
                        /(oem|brand)/i.test(m.key) ||
                        (m.namespace === "custom" &&
                          /(oem|brand)/i.test(m.key)),
                    )
                    .map((m: any) => m.value)
                : [];

            const firstVariantId =
              raw?.variants && raw.variants[0] && raw.variants[0].id;

            return {
              id: codeVal,
              code: codeVal,
              title: raw?.title ?? raw?.name ?? `Product ${i + 1}`,
              price,
              image,
              oems: oemsArr,
              productRaw: raw,
              location: "",
              inStock: true,
              stock: 0,
              variantId: firstVariantId
                ? `gid://shopify/ProductVariant/${firstVariantId}`
                : undefined,
            } as Product;
          });

          setFetched(mapped);
        } else {
          setFetched([]);
        }
      } catch (e) {
        console.error("Failed to fetch products for MiniPaginationGroup", e);
        if (mounted) setFetched([]);
      }
    }

    loadAll();

    return () => {
      mounted = false;
      if (mq) {
        if (typeof mq.removeEventListener === "function")
          mq.removeEventListener("change", onChange as any);
        else if (typeof mq.removeListener === "function")
          mq.removeListener(onChange as any);
      }
    };
  }, []);

  const allProducts =
    products && products.length > 0 ? products : (fetched ?? []);
  const total = allProducts.length;
  const totalPages = 20;
  const pageItems = allProducts.slice((page - 1) * pageSize, page * pageSize);

  function goto(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
  }

  const slugify = (s: string) =>
    String(s)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$|^$/g, "");

  const targetCollection = `/collections/${encodeURIComponent(
    (collectionId && String(collectionId)) ||
      (collectionHandle && String(collectionHandle)) ||
      slugify(title),
  )}`;

  return (
    <section className="w-full px-4 md:px-6 lg:px-12 py-6">
      <div className="flex items-center justify-between mb-4 w-full">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Link
          href={targetCollection}
          className="text-sm text-primary hover:underline"
        >
          See All
        </Link>
      </div>

      <div className="flex flex-row gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory py-2">
        {pageItems.map((p) => (
          <div
            key={String(p.id)}
            className="snap-start shrink-0 w-[60%] sm:w-auto"
          >
            <SingleProdCard
              id={p.id}
              code={p.code}
              title={p.title}
              price={p.price}
              image={p.image}
              oems={p.oems}
              productRaw={p.productRaw}
              location={p.location}
              inStock={p.inStock}
              stock={p.stock}
              variantId={p.variantId}
              matchType={p.matchType}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 w-full flex items-center justify-center">
        <div className="flex items-center gap-3 w-full max-w-full sm:max-w-[600px] justify-center px-2 mini-pagination-scroll overflow-x-auto sm:overflow-visible">
          <button
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="px-2 sm:px-3 py-1 rounded-md text-sm bg-white border shadow-sm disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-nowrap">
            {(() => {
              type PageToken = number | "ellipsis";

              function buildPagination(
                total: number,
                current: number,
                edge = 3,
                around = 1,
              ): PageToken[] {
                if (total <= edge * 2 + around * 2 + 3) {
                  return Array.from({ length: total }, (_, i) => i + 1);
                }

                const pages = new Set<number>();
                for (let i = 1; i <= Math.min(edge, total); i++) pages.add(i);
                for (let i = Math.max(1, total - edge + 1); i <= total; i++)
                  pages.add(i);
                for (
                  let i = Math.max(1, current - around);
                  i <= Math.min(total, current + around);
                  i++
                )
                  pages.add(i);

                const arr = Array.from(pages).sort((a, b) => a - b);
                const out: PageToken[] = [];
                for (let i = 0; i < arr.length; i++) {
                  out.push(arr[i]);
                  if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1)
                    out.push("ellipsis");
                }
                return out;
              }

              const tokens = buildPagination(
                totalPages,
                page,
                isCompact ? 2 : 3,
                isCompact ? 0 : 1,
              );

              return tokens.map((t, idx) => {
                if (t === "ellipsis") {
                  return (
                    <span key={`e-${idx}`} className="px-2 text-sm text-muted">
                      /
                    </span>
                  );
                }

                const p = t as number;
                return (
                  <button
                    key={p}
                    onClick={() => goto(p)}
                    aria-current={p === page ? "page" : undefined}
                    className={`px-2 sm:px-3 py-1 rounded-md text-sm ${
                      p === page ? "bg-secondary text-white" : "bg-white border"
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}
          </div>

          <button
            onClick={() => goto(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded-md bg-white border shadow-sm disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6l6 6-6 6"
              />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .mini-pagination-scroll {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        .mini-pagination-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
    </section>
  );
}
