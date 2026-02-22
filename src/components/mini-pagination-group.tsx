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

              const oemsArr = (() => {
                const oemMeta =
                  raw?.metafields && Array.isArray(raw.metafields)
                    ? raw.metafields.find(
                        (m: any) =>
                          m.namespace === "custom" && m.key === "oem_info",
                      )
                    : null;
                if (!oemMeta?.value) return [];
                try {
                  const parsed = JSON.parse(oemMeta.value);
                  return Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  return [oemMeta.value];
                }
              })();

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

            const oemsArr = (() => {
              const oemMeta =
                raw?.metafields && Array.isArray(raw.metafields)
                  ? raw.metafields.find(
                      (m: any) =>
                        m.namespace === "custom" && m.key === "oem_info",
                    )
                  : null;
              if (!oemMeta?.value) return [];
              try {
                const parsed = JSON.parse(oemMeta.value);
                return Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                return [oemMeta.value];
              }
            })();

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = allProducts.slice((page - 1) * pageSize, page * pageSize);

  function goto(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
  }

  type PageToken = number | "ellipsis";
  function buildPageTokens(total: number, current: number): PageToken[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set<number>();
    // always show first and last
    pages.add(1);
    pages.add(total);
    // always show current ± 1
    for (
      let i = Math.max(1, current - 1);
      i <= Math.min(total, current + 1);
      i++
    )
      pages.add(i);
    const arr = Array.from(pages).sort((a, b) => a - b);
    const out: PageToken[] = [];
    for (let i = 0; i < arr.length; i++) {
      out.push(arr[i]);
      if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) out.push("ellipsis");
    }
    return out;
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

      {/* ── PAGINATION ── */}
      <div className="mt-6 w-full flex items-center justify-center">
        {/* Mobile: Prev · Page X of Y · Next */}
        <div className="flex sm:hidden items-center gap-3">
          <button
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 shadow-sm disabled:opacity-40 active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-4 h-4 shrink-0"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
            Prev
          </button>

          <span className="text-sm font-semibold text-gray-800 min-w-[64px] text-center tabular-nums">
            {page}
            <span className="text-gray-400 font-normal"> / {totalPages}</span>
          </span>

          <button
            onClick={() => goto(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 shadow-sm disabled:opacity-40 active:scale-95 transition-all"
          >
            Next
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-4 h-4 shrink-0"
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

        {/* Desktop: full page buttons with ellipsis */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
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

          {buildPageTokens(totalPages, page).map((t, idx) => {
            if (t === "ellipsis") {
              return (
                <span
                  key={`e-${idx}`}
                  className="flex items-center justify-center w-9 h-9 text-gray-400 text-sm select-none"
                >
                  &hellip;
                </span>
              );
            }
            const pg = t as number;
            return (
              <button
                key={pg}
                onClick={() => goto(pg)}
                aria-current={pg === page ? "page" : undefined}
                className={`flex items-center justify-center w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                  pg === page
                    ? "bg-secondary text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pg}
              </button>
            );
          })}

          <button
            onClick={() => goto(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
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
    </section>
  );
}
