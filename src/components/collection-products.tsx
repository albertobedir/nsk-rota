/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import SingleProdCard from "@/components/single-prod-cart";

export default function CollectionProducts({
  products,
  perPage = 12,
  searchTerm,
}: {
  products: any[];
  perPage?: number;
  searchTerm?: string;
}) {
  const [page, setPage] = useState(1);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pageItems = products.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {pageItems.map((product: any) => {
          // Use oems directly if available (from collection page), otherwise extract from metafields
          const oemsArr =
            product.oems && product.oems.length > 0
              ? product.oems
              : (() => {
                  const oemMeta = product.raw?.metafields?.find(
                    (m: any) =>
                      m.namespace === "custom" && m.key === "oem_info",
                  );
                  if (!oemMeta?.value) return [];
                  try {
                    const parsed = JSON.parse(oemMeta.value);
                    return Array.isArray(parsed) ? parsed : [parsed];
                  } catch {
                    return [oemMeta.value];
                  }
                })();

          // Extract code/rota from metafields
          const extractRotaNoFromMetafields = (metafields: any[] = []) => {
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
                    "Unknown"
                  );
                }
                if (parsed && typeof parsed === "object") {
                  return (
                    parsed.RotaNo ||
                    parsed.rotaNo ||
                    parsed.Rota ||
                    parsed.rota ||
                    "Unknown"
                  );
                }
              } catch (e) {
                const m = String(candidate.value).match(/\d{3,}/);
                if (m) return m[0];
              }
            }

            return "Unknown";
          };

          const code =
            product.code ??
            extractRotaNoFromMetafields(product.raw?.metafields);

          // Determine match type based on searchTerm
          const matchType = (() => {
            const q = (searchTerm ?? "").toString().trim();
            if (!q) return undefined;
            const lowerQ = q.toLowerCase();
            const codeStr = String(code ?? "").toLowerCase();
            const titleStr = String(product.raw?.title ?? "").toLowerCase();

            if (codeStr === lowerQ || titleStr === lowerQ)
              return "exact" as const;
            if (codeStr.includes(lowerQ) || titleStr.includes(lowerQ))
              return "partial" as const;
            return undefined;
          })();

          const price = Number(product.raw?.variants?.[0]?.price ?? "0");
          const image = product.raw?.images?.[0]?.src ?? "";
          const shopifyId = product.shopifyId ?? (product.raw as any)?.id;

          // Extract stock information from inventory_locations if available
          const firstVariant = product.raw?.variants?.[0];
          const invs = firstVariant?.inventory_locations;
          let stockLocation = "CHICAGO";
          let stockAmount: number | undefined = undefined;
          let hasStockInfo = false;

          if (Array.isArray(invs) && invs.length > 0) {
            // prefer index 1 if available, otherwise first
            const preferred = invs[1] ?? invs[0];
            if (preferred) {
              stockLocation =
                preferred.location_name || preferred.location || "CHICAGO";
              stockAmount = Number(
                preferred.available ?? preferred.quantity ?? 0,
              );
              hasStockInfo = true;
            }
          }

          return (
            <SingleProdCard
              key={product._id}
              id={code}
              code={code}
              title={product.raw?.title}
              shopifyId={shopifyId}
              productRaw={product.raw}
              price={price}
              image={image}
              oems={oemsArr}
              variantId={`gid://shopify/ProductVariant/${product.raw?.variants?.[0]?.id}`}
              location={stockLocation}
              inStock={hasStockInfo ? (stockAmount ?? 0) > 0 : true}
              stock={hasStockInfo ? stockAmount : undefined}
              matchType={matchType}
              searchTerm={searchTerm}
            />
          );
        })}
      </div>

      {total > 0 && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
