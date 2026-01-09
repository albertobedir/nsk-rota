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
};

export default function MiniPaginationGroup({
  title,
  products,
  pageSize = 5,
}: {
  title: string;
  products?: Product[];
  pageSize?: number;
}) {
  const [fetched, setFetched] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
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
                  (m.namespace === "custom" && /(oem|brand)/i.test(m.key))
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
                        (m.namespace === "custom" && /(oem|brand)/i.test(m.key))
                    )
                    .map((m: any) => m.value)
                : [];

            return {
              id: codeVal,
              code: codeVal,
              title: raw?.title ?? raw?.name ?? `Product ${i + 1}`,
              price,
              image,
              oems: oemsArr,
              location: "",
              inStock: true,
              stock: 0,
              variantId: raw?.variants?.[0]?.id ?? undefined,
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
    };
  }, []);

  const allProducts =
    products && products.length > 0 ? products : fetched ?? [];
  const total = allProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = allProducts.slice((page - 1) * pageSize, page * pageSize);

  function goto(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
  }

  return (
    <section className="w-full px-4 md:px-6 lg:px-12 py-6">
      <div className="flex items-center justify-between mb-4 w-full">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Link href="#" className="text-sm text-primary hover:underline">
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
              location={p.location}
              inStock={p.inStock}
              stock={p.stock}
              variantId={p.variantId}
              matchType={p.matchType}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => goto(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded-md bg-white border shadow-sm disabled:opacity-50"
        >
          Prev
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => goto(p)}
                className={`px-3 py-1 rounded-md ${
                  p === page ? "bg-secondary text-white" : "bg-white border"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => goto(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded-md bg-white border shadow-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
