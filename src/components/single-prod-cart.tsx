/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";

// ── Singleton cache for DB pricing tiers ─────────────────────────────────────
// Shared across all card instances so only ONE fetch fires per page, and
// subsequent tierTag changes resolve from cache with zero network delay.
type _TiersDbCache = {
  tiers: any[] | null;
  fetchedAt: number;
  inflight: Promise<any[]> | null;
};
const _tiersDb: _TiersDbCache = { tiers: null, fetchedAt: 0, inflight: null };
const TIERS_TTL_MS = 30_000; // 30 s — short enough to catch admin changes quickly

function fetchPricingTiersDb(): Promise<any[]> {
  const now = Date.now();
  // Return cached data if still fresh
  if (_tiersDb.tiers !== null && now - _tiersDb.fetchedAt < TIERS_TTL_MS) {
    return Promise.resolve(_tiersDb.tiers);
  }
  // Deduplicate concurrent requests — share the in-flight promise
  if (_tiersDb.inflight) return _tiersDb.inflight;

  _tiersDb.inflight = fetch(`/api/pricing-tiers/db`)
    .then((r) => r.json())
    .then((json) => {
      _tiersDb.tiers = json?.results ?? [];
      _tiersDb.fetchedAt = Date.now();
      _tiersDb.inflight = null;
      return _tiersDb.tiers!;
    })
    .catch(() => {
      _tiersDb.inflight = null;
      return _tiersDb.tiers ?? [];
    });

  return _tiersDb.inflight;
}
// ── call this after an admin tier change to force a fresh fetch ──
export function invalidatePricingTiersCache() {
  _tiersDb.tiers = null;
  _tiersDb.fetchedAt = 0;
  _tiersDb.inflight = null;
}
// ─────────────────────────────────────────────────────────────────────────────
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";
import useSessionStore from "@/store/session-store";
import Icons from "./icons";
import { Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";

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
  const cart = useSessionStore((s) => s.cart);

  // use string so user can clear the field while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");
  const [offerOpen, setOfferOpen] = useState(false);

  // determine exact match also when OEM number equals searchTerm
  const extractOemNo = (entry: any) => {
    try {
      if (!entry) return null;
      if (typeof entry === "object") {
        return (
          entry.OemNo ||
          entry.OEMNo ||
          entry.oemNo ||
          entry.Oem ||
          entry.RotaNo ||
          entry.rotaNo ||
          entry.Rota ||
          entry.rota ||
          null
        );
      }
      const s = String(entry).trim();
      if (s.startsWith("[") || s.startsWith("{")) {
        const parsed = JSON.parse(s);
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (obj && typeof obj === "object") {
          return (
            obj.OemNo ||
            obj.OEMNo ||
            obj.oemNo ||
            obj.Oem ||
            obj.RotaNo ||
            obj.rotaNo ||
            null
          );
        }
      }
      return s || null;
    } catch {
      return String(entry || "");
    }
  };

  const oemExactMatch = React.useMemo(() => {
    try {
      const terms = String(searchTerm ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      if (terms.length === 0) return false;
      if (!Array.isArray(oems)) return false;
      return oems.some((e) => {
        const val = String(extractOemNo(e) ?? "")
          .trim()
          .toLowerCase();
        return terms.some((t) => val === t);
      });
    } catch {
      return false;
    }
  }, [oems, searchTerm]);

  const oemPartialMatch = React.useMemo(() => {
    try {
      const terms = String(searchTerm ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      if (terms.length === 0) return false;
      if (!Array.isArray(oems)) return false;
      return oems.some((e) => {
        const val = String(extractOemNo(e) ?? "")
          .trim()
          .toLowerCase();
        return terms.some((t) => val.includes(t) && val !== t);
      });
    } catch {
      return false;
    }
  }, [oems, searchTerm]);
  // Extract competitor ReferansView values from productRaw metafields
  const competitorRefs = React.useMemo(() => {
    try {
      const metafields: any[] =
        productRaw?.metafields ?? productRaw?.raw?.metafields ?? [];
      const entry = metafields.find(
        (m: any) => m?.namespace === "custom" && m?.key === "competitor_info",
      );
      if (!entry) return [];
      const parsed =
        typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((c: any) =>
          String(c?.ReferansView ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  }, [productRaw]);

  const competitorExactMatch = React.useMemo(() => {
    if (competitorRefs.length === 0) return false;
    const terms = String(searchTerm ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return terms.some((t) => competitorRefs.includes(t));
  }, [competitorRefs, searchTerm]);

  const competitorPartialMatch = React.useMemo(() => {
    if (competitorRefs.length === 0) return false;
    const terms = String(searchTerm ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return terms.some((t) =>
      competitorRefs.some((r) => r.includes(t) && r !== t),
    );
  }, [competitorRefs, searchTerm]);

  const searchTerms = React.useMemo(
    () =>
      String(searchTerm ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase()),
    [searchTerm],
  );

  const isCodeExactMatch =
    searchTerms.length > 0 && searchTerms.includes(String(code).toLowerCase());
  const isCodePartialMatch =
    searchTerms.length > 0 &&
    !isCodeExactMatch &&
    searchTerms.some((t) => String(code).toLowerCase().includes(t));

  const isExactBadge =
    matchType === "exact" ||
    oemExactMatch ||
    isCodeExactMatch ||
    competitorExactMatch;
  const isPartialBadge =
    matchType === "partial" ||
    (!isExactBadge && oemPartialMatch) ||
    (!isExactBadge && isCodePartialMatch) ||
    (!isExactBadge && competitorPartialMatch);
  const isExactTitle = matchType === "exact" || isCodeExactMatch;
  const isPartial = matchType === "partial";
  const tierTag = useSessionStore((s) => s.tierTag);
  const getDiscountForTier = useSessionStore((s) => s.getDiscountForTier);
  const discountPercentage = getDiscountForTier();
  const [prismaDiscount, setPrismaDiscount] = React.useState<number | null>(
    null,
  );

  const effectiveDiscount = prismaDiscount ?? discountPercentage ?? null;
  const tierPrice = effectiveDiscount
    ? Number((Number(price) * (1 - effectiveDiscount / 100)).toFixed(2))
    : null;

  // Use rota/code as product link identifier (prefer `code` always)
  const productLinkId = (() => {
    try {
      if (code && (typeof code === "string" || typeof code === "number"))
        return String(code);
    } catch (e) {
      /* ignore */
    }
    return String(id ?? "unknown");
  })();

  // Prefer an image from productRaw.images that contains `/files/<digits>` (4+ digits)
  // when there are multiple images. Fall back to the `image` prop.
  const displayImage = (() => {
    try {
      const imgs = productRaw?.images;
      if (Array.isArray(imgs) && imgs.length > 0) {
        if (imgs.length > 1) {
          // find image whose src contains `/files/` followed by 4 or more digits
          const matched = imgs.find((it: any) => {
            const src = String(it?.src || it?.url || "");
            return /\/files\/(\d{4,})/.test(src);
          });
          if (matched) return String(matched?.src || matched?.url || image);
        }
        // fallback to first image entry
        const first = imgs[0];
        return String(first?.src || first?.url || image);
      }
    } catch (e) {
      // ignore and fallback
    }
    return image;
  })();

  // Fetch pricing tiers via shared module-level cache — only ONE request fires
  // across all card instances. When tierTag changes the cache is read immediately
  // so the price update is instant with no per-card network round-trip.
  React.useEffect(() => {
    let mounted = true;

    fetchPricingTiersDb().then((tiers) => {
      if (!mounted) return;
      const tag = tierTag ?? null;
      if (!tag) {
        setPrismaDiscount(null);
        return;
      }
      const normalized = String(tag).toLowerCase().trim();
      const found = tiers.find(
        (t) =>
          String(t.tierTag ?? "")
            .toLowerCase()
            .trim() === normalized,
      );
      const discount = found ? Number(found.discountPercentage) : null;
      setPrismaDiscount(discount);
    });

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

  // Prefer `oems` prop but fall back to productRaw's OEMs if empty
  const displayedOems = (() => {
    try {
      if (Array.isArray(oems) && oems.length > 0) return oems;
      if (Array.isArray(productRaw?.Oems) && productRaw.Oems.length > 0)
        return productRaw.Oems;
      if (Array.isArray(productRaw?.oems) && productRaw.oems.length > 0)
        return productRaw.oems;
    } catch {
      /* ignore */
    }
    return [] as any[];
  })();

  const renderOemEntry = (entry: any) => {
    try {
      if (!entry) return null;

      // Highlight only the OEM number when it matches the search term.
      const highlightOem = (text?: string | null) => {
        if (!text) return null;
        const terms = String(searchTerm ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.toLowerCase());
        if (terms.length === 0) return text;
        try {
          const esc = terms
            .map((t) => t.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
            .join("|");
          const parts = String(text).split(new RegExp(`(${esc})`, "gi"));
          const oemLower = String(text).trim().toLowerCase();
          const isThisExact = terms.includes(oemLower);
          return parts.map((part: string, idx: number) => {
            const lower = part.toLowerCase();
            if (terms.includes(lower)) {
              return (
                <span
                  key={idx}
                  className={
                    isThisExact
                      ? "bg-green-200 inline-block px-1 rounded"
                      : "bg-yellow-200 inline-block px-1 rounded"
                  }
                >
                  {part}
                </span>
              );
            }
            return <span key={idx}>{part}</span>;
          });
        } catch {
          return text;
        }
      };

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
                <div className="text-sm">
                  {brand ? (
                    <span className="font-semibold uppercase mr-1">
                      {String(brand)}
                    </span>
                  ) : null}
                  {brand ? <span className="px-1">:</span> : null}
                  {oemno ? (
                    <span className="font-medium">
                      {highlightOem(String(oemno)) ?? oemno}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          }
        }

        // fallback for plain string entry — don't highlight rota/brand here
        return <span className="font-normal">{String(entry)}</span>;
      }

      if (typeof entry === "object") {
        const obj = entry as any;
        const rota = obj.RotaNo || obj.rotaNo || obj.Rota || obj.rota;
        const oemno = obj.OemNo || obj.OEMNo || obj.oemNo || obj.Oem || "";
        const brand =
          obj.MarkaDescription || obj.BrandDescription || obj.Brand || "";
        return (
          <div className="leading-tight">
            <div className="text-sm">
              {brand ? (
                <span className="font-semibold uppercase mr-1">
                  {String(brand)}
                </span>
              ) : null}
              {brand ? <span className="px-1">:</span> : null}
              {oemno ? (
                <span className="font-medium">
                  {highlightOem(String(oemno)) ?? oemno}
                </span>
              ) : null}
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
    <>
      <Card className="shadow-none bg-white flex flex-col gap-0 rounded-md w-full p-0 border-2 h-full">
        <div className="relative w-full rounded-t-[inherit] h-36 md:h-56 lg:h-64">
          {/* Match badge overlay (top-left) */}
          {isExactBadge || isPartialBadge ? (
            <div
              className={`absolute left-3 top-3 z-10 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${
                isExactBadge
                  ? " text-green-700"
                  : isPartialBadge
                    ? " text-yellow-700"
                    : " text-orange-700"
              }`}
            >
              <span
                className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                  isExactBadge
                    ? "bg-green-600 text-white"
                    : isPartialBadge
                      ? "bg-yellow-500 text-white"
                      : "bg-orange-500 text-white"
                }`}
              >
                {isExactBadge ? (
                  <span className="flex items-center gap-0">
                    <Check size={12} className="text-white" />
                    <Check size={10} className="-ml-1 text-white" />
                  </span>
                ) : (
                  <Check size={14} className="text-white" />
                )}
              </span>
              <span className="text-[1rem]">
                {isExactBadge
                  ? "Exact match"
                  : isPartialBadge
                    ? "Partial match"
                    : "Partial match"}
              </span>
            </div>
          ) : null}
          {!displayImage ? (
            <div className="w-full h-full flex items-center justify-center bg-muted-foreground/5 rounded-[inherit]">
              <ImageIcon size={48} className="text-muted-foreground" />
            </div>
          ) : (
            <Image
              alt={title}
              fill
              className="rounded-[inherit] object-contain"
              src={displayImage}
            />
          )}
        </div>

        <div className="flex flex-col bg-white gap-2 p-3 flex-1 overflow-hidden">
          {/* Product Title */}
          <Link
            href={`/products/${encodeURIComponent(String(productLinkId))}`}
            className="hover:underline"
          >
            <div>
              {/* Prominent code (styled for exact/partial matches) */}
              <p
                className={`font-extrabold text-2xl md:text-3xl leading-none mb-1 ${
                  isExactTitle ? "text-[#1f1f1f]" : "text-[#1f1f1f]"
                }`}
              >
                {isExactTitle ? (
                  <span className="bg-green-200 inline-block px-2 py-0.5 rounded ">
                    {code}
                  </span>
                ) : isPartial && searchTerm ? (
                  // highlight only matching substrings for partial match (support multiple comma-separated terms)
                  (() => {
                    const terms = String(searchTerm ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => s.toLowerCase());
                    if (terms.length === 0) return code;
                    const esc = terms
                      .map((t) => t.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
                      .join("|");
                    const parts = code.split(new RegExp(`(${esc})`, "gi"));
                    return parts.map((part, idx) =>
                      terms.includes(part.toLowerCase()) ? (
                        <span key={idx} className="bg-yellow-200  px-1 rounded">
                          {part}
                        </span>
                      ) : (
                        <span key={idx}>{part}</span>
                      ),
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

          {/* Price under title (hidden when price is 0) */}
          {Number(price) > 0 && (
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
            </div>
          )}

          {/* OEM dynamic list — grouped by brand */}
          {displayedOems && displayedOems.length > 0 ? (
            <div className="text-sm leading-[1.35] overflow-y-auto overflow-x-hidden single-prod-scroll">
              {(() => {
                // Parse each entry into { brand, oemno }
                const parseEntry = (
                  entry: any,
                ): { brand: string; oemno: string } => {
                  try {
                    if (!entry) return { brand: "", oemno: "" };
                    if (typeof entry === "string") {
                      const s = entry.trim();
                      if (s.startsWith("[") || s.startsWith("{")) {
                        const parsed = JSON.parse(s);
                        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
                        if (obj && typeof obj === "object") {
                          return {
                            brand: String(
                              obj.MarkaDescription ||
                                obj.BrandDescription ||
                                obj.Brand ||
                                "",
                            ),
                            oemno: String(
                              obj.OemNo ||
                                obj.OEMNo ||
                                obj.oemNo ||
                                obj.Oem ||
                                "",
                            ),
                          };
                        }
                      }
                      return { brand: "", oemno: s };
                    }
                    if (typeof entry === "object") {
                      return {
                        brand: String(
                          entry.MarkaDescription ||
                            entry.BrandDescription ||
                            entry.Brand ||
                            "",
                        ),
                        oemno: String(
                          entry.OemNo ||
                            entry.OEMNo ||
                            entry.oemNo ||
                            entry.Oem ||
                            "",
                        ),
                      };
                    }
                  } catch {}
                  return { brand: "", oemno: String(entry) };
                };

                // Highlight matching OEM number
                const hlOem = (text: string) => {
                  const terms = String(searchTerm ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => s.toLowerCase());
                  if (terms.length === 0) return <span>{text}</span>;
                  try {
                    const esc = terms
                      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                      .join("|");
                    const parts = text.split(new RegExp(`(${esc})`, "gi"));
                    const oemLower = text.trim().toLowerCase();
                    const isExact = terms.includes(oemLower);
                    return (
                      <>
                        {parts.map((part, idx) =>
                          terms.includes(part.toLowerCase()) ? (
                            <span
                              key={idx}
                              className={
                                isExact
                                  ? "bg-green-200 px-1 rounded"
                                  : "bg-yellow-200 px-1 rounded"
                              }
                            >
                              {part}
                            </span>
                          ) : (
                            <span key={idx}>{part}</span>
                          ),
                        )}
                      </>
                    );
                  } catch {
                    return <span>{text}</span>;
                  }
                };

                // Group by brand
                const groups = new Map<string, string[]>();
                displayedOems.forEach((entry: any) => {
                  const { brand, oemno } = parseEntry(entry);
                  const key = brand;
                  if (!groups.has(key)) groups.set(key, []);
                  if (oemno) groups.get(key)!.push(oemno);
                });

                return Array.from(groups.entries()).map(
                  ([brand, oemnos], gi) => (
                    <div
                      key={gi}
                      className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 font-semibold text-sm mb-4"
                    >
                      {brand && (
                        <span className="font-semibold uppercase shrink-0">
                          {brand} :
                        </span>
                      )}
                      {oemnos.map((oemno, ni) => (
                        <React.Fragment key={ni}>
                          {ni > 0 && <span className="text-gray-300">·</span>}
                          <span className="font-medium">{hlOem(oemno)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  ),
                );
              })()}
            </div>
          ) : null}

          {/* Dynamic badges (location, stock) */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Location and Stock (computed from productRaw when available) */}
            {(displayedLocation || location) && (
              <div className="flex items-center gap-1 text-blue-600 font-bold">
                <Icons name="konum" />
                {displayedLocation || location}
              </div>
            )}
            {(() => {
              const isInStock =
                typeof displayedStock === "number"
                  ? displayedStock > 0
                  : inStock;

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

          {/* Quantity + Add to cart / Get Offer / Out of Stock */}
          <div className="mt-auto pt-2">
            {(() => {
              const hasPrice = Number(price) > 0;
              const hasStockInfo = displayedStock !== undefined;
              const isActuallyInStock =
                typeof displayedStock === "number"
                  ? displayedStock > 0
                  : inStock;

              // No stock info OR explicitly out of stock
              if (!hasStockInfo || !isActuallyInStock) {
                return (
                  <button
                    onClick={() => setOfferOpen(true)}
                    className="w-full h-10 font-bold bg-secondary text-white rounded-md hover:brightness-110 transition"
                  >
                    Get Offer
                  </button>
                );
              }

              // Has stock but no price → Get Offer
              if (hasStockInfo && isActuallyInStock && !hasPrice) {
                return (
                  <button
                    onClick={() => setOfferOpen(true)}
                    className="w-full h-10 font-bold bg-secondary text-white rounded-md hover:brightness-110 transition"
                  >
                    Get Offer
                  </button>
                );
              }

              // Normal: has stock + has price → qty + add to cart
              return (
                <div className="flex w-full border-2 border-secondary rounded-md overflow-hidden">
                  <input
                    type="number"
                    min={1}
                    max={maxAvailable}
                    value={qty}
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
                    className="w-20 h-10 px-3 text-center bg-white border-none outline-none"
                    aria-label="Quantity"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const desiredQty = Number(qty || 1);

                        // Stock cap: account for items already in cart
                        if (typeof displayedStock === "number") {
                          const avail = displayedStock;
                          const existingInCart =
                            cart.find((p) => p.id === String(code))?.quantity ??
                            0;
                          const remaining = avail - existingInCart;

                          if (remaining <= 0) {
                            toast.warning(
                              "Maximum available stock is already in your cart",
                            );
                            return;
                          }

                          if (desiredQty > remaining) {
                            setQty(String(remaining));
                            toast.warning(
                              `Quantity reduced to ${remaining} (maximum remaining stock). Please click Add to Cart again.`,
                            );
                            return;
                          }
                        }

                        if (variantId) {
                          const resp = await fetch("/api/cart/add", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              merchandiseId: variantId,
                              quantity: desiredQty,
                            }),
                          });
                          if (!resp.ok) {
                            const err = await resp.json().catch(() => null);
                            throw new Error(
                              err?.message || "Failed to add to cart",
                            );
                          }
                        }
                        addToCart({
                          id: String(code),
                          title,
                          price: Number(tierPrice ?? Number(price)),
                          image,
                          quantity: desiredQty,
                          variantId: variantId ?? "",
                        });
                        toast.success("Product added to cart!");
                      } catch (e) {
                        console.error("Add to cart failed:", e);
                        toast.error("Failed to add to cart");
                      }
                    }}
                    className="flex-1 bg-secondary text-white font-bold h-10 hover:brightness-110 transition active:brightness-90"
                  >
                    Add to cart
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </Card>

      {/* Get Offer Dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Request product: <span className="text-secondary">{code}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            <p className="text-sm font-semibold text-gray-700 mb-2">Details</p>
            <textarea
              id="product-request-message"
              rows={4}
              defaultValue={`I'm looking for: ${searchTerm ?? code}`}
              className="w-full border border-gray-200 rounded-md p-3 text-sm text-secondary outline-none resize-y"
            />
          </div>

          <DialogFooter className="flex gap-2 justify-end mt-2">
            <Button
              onClick={async () => {
                try {
                  const ta = document.getElementById(
                    "product-request-message",
                  ) as HTMLTextAreaElement | null;
                  const message = ta
                    ? ta.value
                    : `I'm looking for ${searchTerm ?? code}`;
                  const resp = await fetch(`/api/requests/product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      query: searchTerm ?? code,
                      message,
                    }),
                  });
                  if (resp.ok) {
                    toast.success("Request submitted");
                    setOfferOpen(false);
                  } else {
                    toast.error("Failed to submit request");
                  }
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to submit request");
                }
              }}
            >
              Send request
            </Button>
            <Button variant="ghost" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .single-prod-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .single-prod-scroll::-webkit-scrollbar-thumb {
          background: #ff9e1b;
          border-radius: 9999px;
        }
        .single-prod-scroll {
          scrollbar-color: #ff9e1b transparent;
          scrollbar-width: thin;
        }
      `}</style>
    </>
  );
}
