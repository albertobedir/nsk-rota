/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";
import useSessionStore from "@/store/session-store";
import Icons from "./icons";
import { Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ProductCardProps {
  id: string | number;
  code: string;
  title: string;
  price: number;
  image: string;
  shopifyId?: number | string;
  oems?: string[]; // OEM list
  location?: string;
  inStock?: boolean;
  stock?: number | string;
  variantId?: string;
  matchType?: "exact" | "partial" | undefined;
  searchTerm?: string;
  productRaw?: any;
}

export default function SingleProdCard({
  id,
  code,
  title,
  price,
  image,
  oems = [],
  location = "",
  inStock = false,
  stock,
  variantId,
  matchType,
  searchTerm,
  productRaw,
}: ProductCardProps) {
  const addToCart = useSessionStore((s) => s.addToCart);

  // use string so user can clear the field while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");

  const isExact = matchType === "exact";
  const isPartial = matchType === "partial";
  const tierTag = useSessionStore((s) => s.tierTag);
  const getDiscountForTier = useSessionStore((s) => s.getDiscountForTier);
  const discountPercentage = getDiscountForTier();
  const [prismaDiscount, setPrismaDiscount] = React.useState<number | null>(
    null
  );

  const effectiveDiscount = prismaDiscount ?? discountPercentage ?? null;
  const tierPrice = effectiveDiscount
    ? Number((Number(price) * (1 - effectiveDiscount / 100)).toFixed(2))
    : null;

  // Build product detail link id: prefer variant id (numeric part of `variantId`),
  // fallback to numeric `id` or `code`.
  const productLinkId = (() => {
    try {
      if (variantId) {
        const s = String(variantId);
        const m = s.match(/(\d+)$/);
        if (m) return m[1];
        if (/^\d+$/.test(s)) return s;
      }

      if (typeof id === "number") return String(id);
      if (typeof id === "string" && /^\d{6,}$/.test(id)) return id;

      if (code && typeof code === "string") return code;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* ignore */
    }
    return String(id ?? "unknown");
  })();

  // Fetch pricing tiers from Prisma-backed API and log discount for current tierTag
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/pricing-tiers/db`);
        const json = await resp.json().catch(() => null);
        const tiers: any[] = json?.results || [];
        const tag = tierTag ?? null;
        if (!tag) {
          console.log("[single-prod-cart] no tierTag present");
          return;
        }
        const normalized = String(tag).toLowerCase().trim();
        const found = tiers.find(
          (t) =>
            String(t.tierTag ?? "")
              .toLowerCase()
              .trim() === normalized
        );
        const discount = found ? Number(found.discountPercentage) : null;
        if (mounted) {
          setPrismaDiscount(discount);
          console.log(
            `[single-prod-cart] prisma discountPercentage for ${tag}:`,
            discount
          );
        }
      } catch (e) {
        console.warn("[single-prod-cart] pricing tiers fetch failed", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tierTag]);

  // Determine displayed location and stock.
  // Preference order:
  // 1) If `location` and `stock` props provided, use them.
  // 2) If `productRaw.variants[0].inventory_locations[1]` exists, use that (user requested index 1).
  // 3) Fallback to `productRaw.variants[0].inventory_locations[0]`.
  // 4) Fallback to `stock`/`inStock` props as before.
  const { displayedLocation, displayedStock } = (() => {
    try {
      if (location && stock !== undefined && stock !== null) {
        return { displayedLocation: location, displayedStock: Number(stock) };
      }

      const firstVariant = productRaw?.variants && productRaw.variants[0];
      const invs = firstVariant?.inventory_locations;
      if (Array.isArray(invs) && invs.length > 0) {
        // prefer index 1 if available
        const preferred = invs[1] ?? invs[0];
        if (preferred) {
          const name =
            preferred.location_name ||
            preferred.location ||
            String(preferred.location_id || "");
          const qty = Number(preferred.available ?? preferred.quantity ?? 0);
          return {
            displayedLocation: name,
            displayedStock: Number.isNaN(qty) ? undefined : qty,
          };
        }
      }
    } catch {
      // ignore
    }

    if (stock !== undefined && stock !== null) {
      const n = Number(stock as any);
      return {
        displayedLocation: location,
        displayedStock: Number.isNaN(n) ? undefined : n,
      };
    }

    if (inStock)
      return { displayedLocation: location, displayedStock: undefined };

    return { displayedLocation: location, displayedStock: undefined };
  })();

  const maxAvailable =
    typeof displayedStock === "number"
      ? displayedStock === 0
        ? 0
        : Math.max(1, displayedStock)
      : undefined;
  const outOfStock = maxAvailable === 0;

  const renderOemEntry = (entry: any) => {
    try {
      if (!entry) return null;
      if (typeof entry === "string") {
        const s = entry.trim();
        // try parse JSON
        if (s.startsWith("[") || s.startsWith("{")) {
          const parsed = JSON.parse(s);
          const obj = Array.isArray(parsed) ? parsed[0] : parsed;
          if (obj && typeof obj === "object") {
            const rota = obj.RotaNo || obj.rotaNo || obj.Rota || obj.rota;
            const oemno = obj.OemNo || obj.OEMNo || obj.oemNo || obj.Oem || "";
            const brand =
              obj.MarkaDescription || obj.BrandDescription || obj.Brand || "";
            return (
              <div className="leading-tight">
                <div className="font-semibold">{rota ?? ""}</div>
                <div className="text-sm text-muted-foreground">
                  {oemno && <span>{oemno}</span>}
                  {oemno && brand && <span className="px-2">•</span>}
                  {brand && <span>{brand}</span>}
                </div>
              </div>
            );
          }
        }
      }

      if (typeof entry === "object") {
        const obj = entry as any;
        const rota = obj.RotaNo || obj.rotaNo || obj.Rota || obj.rota;
        const oemno = obj.OemNo || obj.OEMNo || obj.oemNo || obj.Oem || "";
        const brand =
          obj.MarkaDescription || obj.BrandDescription || obj.Brand || "";
        return (
          <div className="leading-tight">
            <div className="font-semibold">{rota ?? ""}</div>
            <div className="text-sm text-muted-foreground">
              {oemno && <span>{oemno}</span>}
              {oemno && brand && <span className="px-2">•</span>}
              {brand && <span>{brand}</span>}
            </div>
          </div>
        );
      }
    } catch (e) {
      console.warn("parse oem entry failed", e);
    }

    return <span className="font-normal">{String(entry)}</span>;
  };

  return (
    <Card className="shadow-none bg-white flex flex-col gap-0 rounded-md w-full p-0 border-2 h-full">
      <div className="relative w-full rounded-t-[inherit] h-48 md:h-56 lg:h-64">
        {/* Match badge overlay (top-left) */}
        {matchType ? (
          <div
            className={`absolute left-3 top-3 z-10 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${
              isExact
                ? " text-green-700"
                : isPartial
                ? " text-yellow-700"
                : " text-orange-700"
            }`}
          >
            <span
              className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                isExact
                  ? "bg-green-600 text-white"
                  : isPartial
                  ? "bg-yellow-500 text-white"
                  : "bg-orange-500 text-white"
              }`}
            >
              {isExact ? (
                <span className="flex items-center gap-0">
                  <Check size={12} className="text-white" />
                  <Check size={10} className="-ml-1 text-white" />
                </span>
              ) : (
                <Check size={14} className="text-white" />
              )}
            </span>
            <span className="text-[1rem]">
              {isExact
                ? "Exact match"
                : isPartial
                ? "Partial match"
                : "Partial match"}
            </span>
          </div>
        ) : null}

        {!image ? (
          <div className="w-full h-full flex items-center justify-center bg-muted-foreground/5 rounded-[inherit]">
            <ImageIcon size={48} className="text-muted-foreground" />
          </div>
        ) : (
          <Image
            alt={title}
            fill
            className="rounded-[inherit] object-contain"
            src={image}
          />
        )}
      </div>

      <div className="flex flex-col bg-white gap-2 p-3 flex-1 overflow-hidden">
        {/* Product Title */}
        <Link href={`/products/${productLinkId}`} className="hover:underline">
          <div>
            {/* Prominent code (styled for exact/partial matches) */}
            <p
              className={`font-extrabold text-2xl md:text-3xl leading-none mb-1 ${
                isExact ? "text-[#1f1f1f]" : "text-[#1f1f1f]"
              }`}
            >
              {isExact ? (
                <span className="bg-green-200 inline-block px-2 py-0.5 rounded ">
                  {code}
                </span>
              ) : isPartial && searchTerm ? (
                // highlight only matching substrings for partial match
                (() => {
                  const q = String(searchTerm).trim();
                  if (!q) return code;
                  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  const parts = code.split(new RegExp(`(${esc})`, "gi"));
                  return parts.map((part, idx) =>
                    part.toLowerCase() === q.toLowerCase() ? (
                      <span key={idx} className="bg-yellow-200  px-1 rounded">
                        {part}
                      </span>
                    ) : (
                      <span key={idx}>{part}</span>
                    )
                  );
                })()
              ) : (
                <span>{code}</span>
              )}
            </p>

            <p className="text-sm font-medium text-gray-700 line-clamp-2">
              {title}
            </p>
          </div>
        </Link>

        {/* Price under title */}
        <div className="mt-1 flex items-center gap-3">
          <div>
            <span className="text-base md:text-lg font-bold text-secondary">
              {(tierPrice ?? Number(price)).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD
            </span>
          </div>
          {/* No badge shown — price is already reduced when effectiveDiscount exists */}
        </div>

        {/* OEM dynamic list (first 3) */}
        {oems && oems.length > 0 ? (
          <div className="relative max-h-14 overflow-y-auto text-sm leading-[1.35] overflow-x-hidden pr-3">
            {oems.slice(0, 3).map((oem, i) => (
              <div key={i} className="font-semibold">
                {renderOemEntry(oem)}
              </div>
            ))}
          </div>
        ) : null}

        {/* Dynamic badges (location, stock) */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Location and Stock (computed from productRaw when available) */}
          <div className="flex items-center gap-1 text-blue-600 font-bold">
            <Icons name="konum" />
            {displayedLocation || location || "—"}
          </div>
          {(() => {
            const isInStock =
              typeof displayedStock === "number" ? displayedStock > 0 : inStock;

            return (
              <div
                className={`flex items-center gap-1 font-bold ${
                  isInStock ? "text-green-600" : "text-red-600"
                }`}
              >
                {isInStock ? <Icons name="stock" /> : <Icons name="x" />}

                {isInStock
                  ? displayedStock !== undefined && displayedStock !== null
                    ? `${displayedStock} in stock`
                    : "In stock"
                  : "Out of stock"}
              </div>
            );
          })()}
        </div>

        {/* Quantity + Add to cart (split control) */}
        <div className="mt-2">
          <div
            className={`flex w-full border-2 ${
              outOfStock ? "border-muted-foreground/30" : "border-secondary"
            } rounded-md overflow-hidden`}
          >
            <input
              type="number"
              min={1}
              max={maxAvailable}
              value={qty}
              disabled={maxAvailable === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setQty("");
                  return;
                }
                const n = Number(v);
                const cap = maxAvailable ?? Number.POSITIVE_INFINITY;
                const parsed = Number.isNaN(n) ? 1 : n;
                const final = Math.max(1, Math.min(parsed, cap));
                setQty(String(final));
              }}
              className="w-20 h-10 px-3 text-center bg-white border-none outline-none disabled:opacity-50"
              aria-label="Quantity"
            />

            <button
              onClick={async () => {
                try {
                  if (maxAvailable === 0) return; // do nothing when out of stock

                  if (variantId) {
                    const resp = await fetch("/api/cart/add", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        merchandiseId: variantId,
                        quantity: Number(qty || 1),
                      }),
                    });

                    if (!resp.ok) {
                      const err = await resp.json().catch(() => null);
                      throw new Error(err?.message || "Failed to add to cart");
                    }
                  }

                  // Update local store regardless so UI updates immediately
                  addToCart({
                    id: String(code),
                    title,
                    price: Number(tierPrice ?? Number(price)),
                    image,
                    quantity: Number(qty || 1),
                    variantId: variantId ?? "",
                  });

                  toast.success("Product added to cart!");
                } catch (e) {
                  console.error("Add to cart failed:", e);
                  toast.error("Failed to add to cart");
                }
              }}
              disabled={maxAvailable === 0}
              className={`
    flex-1
    ${
      maxAvailable === 0
        ? "bg-gray-300 text-gray-700 cursor-not-allowed"
        : "bg-secondary text-white"
    }
    font-bold h-10
    transition duration-150
    ${maxAvailable === 0 ? "" : "hover:brightness-110"}
    active:brightness-90 active:scale-[0.98]
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40
  `}
            >
              {maxAvailable === 0 ? "Out of Stock" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
