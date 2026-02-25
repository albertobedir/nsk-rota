/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import Icons from "@/components/icons";
import useSessionStore from "@/store/session-store";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/* ---------------------- STATIC DATA ---------------------- */

interface ShopifyImage {
  src: string;
  alt?: string | null;
}
interface ShopifyVariant {
  id: number;
  price: string;
  sku?: string | null;
  // optional inventory fields that may be attached by webhook processing
  inventory_quantity?: number | null;
  inventory_locations?: any[] | null;
}
interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}
export interface ShopifyRaw {
  title: string;
  handle: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  metafields: ShopifyMetafield[];
  vendor?: string;
  product_type?: string;
}
interface IProduct {
  _id: string;
  shopifyId: number;
  raw: ShopifyRaw;
}

interface TechInfoRow {
  key: string;
  label: string;
  value_mm: string;
  value_in: string;
}

interface SuitableModel {
  brand: string;
  model: string;
  year: string;
  kw: string;
  hp: string;
  className: string;
  type: string;
}

const TECH_INFO: TechInfoRow[] = [
  { key: "L1", label: "L1 Length", value_mm: "22.244 mm", value_in: '22 1/4"' },
  {
    key: "C1",
    label: "C1 Hole Distance",
    value_mm: "4.374 mm",
    value_in: '4.374"',
  },
  { key: "E1", label: "E1 Hole Ø", value_mm: "0.65 mm", value_in: '0.65"' },
  { key: "F1", label: "F1 Thickness", value_mm: "1 mm", value_in: '1"' },
  {
    key: "G1",
    label: "G1 Pipe/Shaft Ø",
    value_mm: "1.122 mm",
    value_in: '1.122"',
  },
];

// SUITABLE_MODELS is now derived dynamically inside the component from the applications metafield

/* ---------------------- MAIN PAGE ---------------------- */

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const addToCart = useSessionStore((s) => s.addToCart);
  const cart = useSessionStore((s) => s.cart);
  // hook for computing tier discounts — must be called unconditionally
  const getDiscountForTier = useSessionStore((s) => s.getDiscountForTier);
  const tierTag = useSessionStore((s) => s.tierTag);
  const [prismaDiscount, setPrismaDiscount] = useState<number | null>(null);

  // Log Prisma-backed discountPercentage for current session tierTag
  // Placed before any early returns to keep hook order stable
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`/api/pricing-tiers/db`);
        const json = await resp.json().catch(() => null);
        const tiers: any[] = json?.results || [];
        const tag = tierTag ?? null;
        if (!tag) {
          if (mounted) console.log("[product-page] no tierTag present");
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
        if (mounted) {
          setPrismaDiscount(discount);
          console.log(
            `[product-page] prisma discountPercentage for ${tag}:`,
            discount,
          );
        }
      } catch (e) {
        console.warn("[product-page] pricing tiers fetch failed", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tierTag]);

  const [product, setProduct] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [inchMode, setInchMode] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  // use string so user can clear the input while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");
  const [stockModalOpen, setStockModalOpen] = useState(false);

  /* Components state (moved up to avoid conditional hook calls) */
  const [componentsProducts, setComponentsProducts] = useState<
    { prod: IProduct; qty: number }[]
  >([]);
  const [componentsLoading, setComponentsLoading] = useState(false);

  useEffect(() => {
    if (!product) return;

    let mounted = true;

    (async () => {
      try {
        setComponentsLoading(true);

        // 1) Try metafield with key ending in "comp"
        const compsField = product.raw?.metafields?.find((m) =>
          /comp$/i.test(m.key),
        );

        // 2) Fall back to raw.Components direct field (e.g. from products.json sync)
        const rawAny = product.raw as any;
        const directComponents: unknown[] | null =
          Array.isArray(rawAny?.Components) && rawAny.Components.length > 0
            ? rawAny.Components
            : null;

        let parsed: unknown[] = [];
        if (compsField) {
          try {
            parsed = JSON.parse(compsField.value) as unknown[];
          } catch {
            parsed = [];
          }
        } else if (directComponents) {
          parsed = directComponents;
        } else {
          if (mounted) setComponentsProducts([]);
          return;
        }

        const results: { prod: IProduct; qty: number }[] = [];

        for (const item of parsed) {
          const obj = item as Record<string, unknown>;
          const compNo = String(
            obj.ComponentNo ?? obj.RotaNo ?? obj.Component ?? "",
          ).trim();
          if (!compNo) continue;

          try {
            const resp = await fetch(
              `/api/products/gets?search=${encodeURIComponent(compNo)}`,
            );
            const json = await resp.json().catch(() => null);
            const found = json?.results?.[0] ?? null;
            if (found) {
              const qty =
                Number(obj.Quantity ?? obj.Count ?? obj.Adet ?? 1) || 1;
              results.push({ prod: found as IProduct, qty });
            }
          } catch (e) {
            console.warn("Failed to fetch component", compNo, e);
          }
        }

        if (mounted) setComponentsProducts(results);
      } finally {
        if (mounted) setComponentsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [product]);

  const handleAddToCart = async () => {
    setAddingToCart(true);

    try {
      // Shopify variant ID'yi al (GID formatında olmalı)
      const variantId = `gid://shopify/ProductVariant/${raw.variants[0].id}`;

      // enforce max quantity based on available stock (from product raw)
      let desiredQty = Number(qty || 1);
      try {
        const firstVariant = raw?.variants && raw.variants[0];
        const invs = firstVariant?.inventory_locations;
        let avail: number | undefined = undefined;
        if (Array.isArray(invs) && invs.length > 0) {
          const preferred = invs[1] ?? invs[0];
          const q = Number(preferred?.available ?? preferred?.quantity ?? 0);
          if (!Number.isNaN(q)) avail = q;
        }
        if (avail === undefined) {
          const q = Number(firstVariant?.inventory_quantity ?? 0);
          if (!Number.isNaN(q)) avail = q;
        }

        if (avail !== undefined) {
          // Account for quantity already in the cart so total never exceeds stock
          const itemId = rotaNo || String(id);
          const existingInCart =
            cart.find((p) => p.id === itemId)?.quantity ?? 0;
          const remaining = avail - existingInCart;

          if (remaining <= 0) {
            toast.warning("Maximum available stock is already in your cart");
            setAddingToCart(false);
            return;
          }

          if (desiredQty > remaining) {
            setQty(String(remaining));
            toast.warning(
              `Quantity reduced to ${remaining} (maximum remaining stock). Please click Add to Cart again.`,
            );
            setAddingToCart(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Call server API to add to Shopify cart
      const resp = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchandiseId: variantId,
          quantity: Number(desiredQty),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || "Failed to add to cart");
      }

      // Update local session store for immediate UI feedback (apply tier price)
      await addToCart({
        id: rotaNo || String(id),
        title,
        price: Number(tierPrice ?? Number(price)),
        image,
        variantId,
        quantity: desiredQty,
      });

      toast.success("Product added to cart!");
    } catch (error) {
      console.error("Add to cart failed:", error);
      toast.error("Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      // Try treat the route param as a Shopify product id first
      const attemptByShopify = await fetch(
        `/api/products/gets?shopifyId=${id}`,
      );
      const shopifyJson = await attemptByShopify.json().catch(() => null);
      let found = shopifyJson?.results?.[0] ?? null;

      // Fallback: if not found, treat param as variant id and try that
      if (!found) {
        const attemptByVariant = await fetch(
          `/api/products/gets?variantId=${id}`,
        );
        const variantJson = await attemptByVariant.json().catch(() => null);
        found = variantJson?.results?.[0] ?? null;
      }

      // Final fallback: keep old behavior and search rota_no
      if (!found) {
        const attemptByRota = await fetch(`/api/products/gets?search=${id}`);
        const rotaJson = await attemptByRota.json().catch(() => null);
        found = rotaJson?.results?.[0] ?? null;
      }

      setProduct(found);
      setLoading(false);
    }

    fetchProduct();
  }, [id]);

  if (loading)
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner label="Loading product..." size={48} />
      </div>
    );
  if (!product) return <div className="p-10 text-2xl">Product not found</div>;

  const raw = product.raw;

  // Derive SUITABLE_MODELS from applications metafield
  const SUITABLE_MODELS: SuitableModel[] = (() => {
    try {
      const appField = raw.metafields?.find(
        (m: any) => m.key === "applications",
      );
      if (!appField?.value) return [];
      const apps = JSON.parse(appField.value) as any[];
      const formatYear = (from: string, to: string) => {
        const fmt = (s: string) =>
          s.length >= 6 ? `${s.slice(0, 4)}/${s.slice(4, 6)}` : s;
        const f = fmt(from);
        const t = to ? fmt(to) : "...";
        return f ? `${f} – ${t}` : "";
      };
      return apps.map((a: any) => ({
        brand: a.BrandDescription ?? "",
        model: a.Model2
          ? `${a.ModelDescription ?? ""} – ${a.Model2}`
          : (a.ModelDescription ?? ""),
        year: formatYear(String(a.YearsFrom ?? ""), String(a.YearsTo ?? "")),
        kw: a.Kw ?? "",
        hp: a.Hp ?? "",
        className: a.VehicleClass ?? "",
        type: a.VehicleType ?? "",
      }));
    } catch {
      return [];
    }
  })();

  const title = raw.title;
  const price = raw.variants?.[0]?.price ?? "0";
  const formattedPrice = Number(price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // tier pricing from session store, prefer Prisma-fetched discount when present
  const discountPercentage = getDiscountForTier();
  const effectiveDiscount = prismaDiscount ?? discountPercentage ?? null;
  const tierPrice = effectiveDiscount
    ? Number((Number(price) * (1 - effectiveDiscount / 100)).toFixed(2))
    : null;
  const formattedTierPrice = tierPrice
    ? tierPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  // (moved earlier) no-op here to avoid duplicate effect
  // Derive preferred inventory location and stock from product raw data
  let displayedLocation: string | undefined = undefined;
  let displayedStock: number | undefined = undefined;
  try {
    const firstVariant = raw?.variants && raw.variants[0];
    const invs = firstVariant?.inventory_locations;
    if (Array.isArray(invs) && invs.length > 0) {
      const preferred = invs[1] ?? invs[0];
      if (preferred) {
        displayedLocation =
          preferred.location_name ||
          preferred.location ||
          String(preferred.location_id || "");
        const qty = Number(
          preferred.available ??
            preferred.quantity ??
            preferred.available_qty ??
            0,
        );
        displayedStock = Number.isNaN(qty) ? undefined : qty;
      }
    }
  } catch {
    // ignore
  }
  const image = raw.images?.[0]?.src ?? "";

  // Build display images from raw.images, moving the "rota no" image to index 0.
  // The rota-no image is identified by its src containing /files/ followed by 4+ digits
  // (e.g. "…/files/29016005.jpg").
  const displayImages: ShopifyImage[] = (() => {
    try {
      const imgs = raw.images;
      if (Array.isArray(imgs) && imgs.length > 0) {
        if (imgs.length > 1) {
          const matchedIdx = imgs.findIndex((it) => {
            const src = String((it as any)?.src || "");
            return /\/files\/\d{4,}/.test(src);
          });
          if (matchedIdx > 0) {
            const ordered = [...imgs];
            const [found] = ordered.splice(matchedIdx, 1);
            ordered.unshift(found);
            return ordered;
          }
        }
        return imgs;
      }
    } catch {
      // ignore – fall through
    }
    return [{ src: image }];
  })();

  // derived availability for controls: treat 0 as out-of-stock
  const pageMaxAvailable =
    typeof displayedStock === "number"
      ? displayedStock === 0
        ? 0
        : Math.max(1, displayedStock)
      : undefined;
  const pageOutOfStock = pageMaxAvailable === 0;
  const extractRotaNo = (metafields: ShopifyMetafield[] = []) => {
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
            parsed[0].rota ||
            parsed[0].Rota ||
            "-"
          );
        }
        if (parsed && typeof parsed === "object") {
          return parsed.RotaNo || parsed.rotaNo || parsed.rota || "-";
        }
      } catch {
        // fallback: try to regexp
        const m = String(candidate.value).match(/\d{3,}/);
        if (m) return m[0];
      }
    }

    return "-";
  };

  const rotaNo = extractRotaNo(raw.metafields);

  // Build dynamic technical information rows from metafields when present.
  const mapHarfToLabel: Record<string, string> = {
    L1: "L1 Length",
    C1: "C1 Hole Distance",
    E1: "E1 Hole Ø",
    F1: "F1 Thickness",
    G1: "G1 Pipe/Shaft Ø",
    d1: "d1",
    d2: "d2",
    A1: "A1",
    J1: "J1",
    W: "Weight",
  };

  const getTechnicalRows = (metafields: ShopifyMetafield[] = []) => {
    try {
      const candidate = metafields.find(
        (m) =>
          /(technical|tech|technical_info)/i.test(m.key) ||
          (m.namespace === "custom" && /(technical|tech)/i.test(m.key)),
      );

      if (!candidate) return TECH_INFO;

      const parsed = JSON.parse(candidate.value);
      if (!Array.isArray(parsed)) return TECH_INFO;

      const asString = (v: unknown) => (v == null ? "" : String(v));
      const rows: TechInfoRow[] = parsed.map((it: unknown) => {
        const obj = it as Record<string, unknown>;
        const key = String(obj.HarfKodu ?? obj.key ?? "");
        return {
          key,
          label: mapHarfToLabel[key] ?? key,
          value_mm: asString(
            obj.Technicalmm ?? obj.TechnicalMM ?? obj.Technical ?? "",
          ),
          value_in: asString(
            obj.Technicalinch ?? obj.TechnicalInch ?? obj.Technicalinch ?? "",
          ),
        } as TechInfoRow;
      });

      return rows.length ? rows : TECH_INFO;
    } catch {
      return TECH_INFO;
    }
  };

  const technicalRows = getTechnicalRows(raw.metafields);
  // Extract ALL brand names — check raw.Brands directly first (Mongoose Mixed),
  // then fall back to the brand_info metafield.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const brandsList = (() => {
    try {
      const rawAny = raw as any;

      // 1) Direct field on raw (e.g. raw.Brands from products.json sync)
      let arr: any[] = [];
      if (Array.isArray(rawAny?.Brands) && rawAny.Brands.length > 0) {
        arr = rawAny.Brands;
      } else if (Array.isArray(rawAny?.brands) && rawAny.brands.length > 0) {
        arr = rawAny.brands;
      } else {
        // 2) Fall back to metafield
        const brandField = raw.metafields?.find(
          (m: any) =>
            /brand/i.test(m.key) ||
            (m.namespace === "custom" && /brand/i.test(m.key)),
        );
        if (brandField?.value) {
          const parsed = JSON.parse(brandField.value);
          arr = Array.isArray(parsed) ? parsed : [parsed];
        }
      }

      if (arr.length === 0) return "";

      const names = arr
        .map(
          (b: any) =>
            b?.BrandDescription || b?.Brand || b?.MarkaDescription || b?.brand,
        )
        .filter(Boolean)
        .map((s: any) => String(s).trim().toUpperCase())
        .filter(Boolean);
      const uniq = Array.from(new Set(names));
      return uniq.join(", ");
    } catch {
      return "";
    }
  })();
  const hasTechnicalInfo = (() => {
    try {
      const candidate = raw.metafields?.find(
        (m: any) =>
          /(technical|tech|technical_info)/i.test(m.key) ||
          (m.namespace === "custom" && /(technical|tech)/i.test(m.key)),
      );
      return Boolean(candidate);
    } catch {
      return false;
    }
  })();

  /* ---------------------- COMPONENTS ---------------------- */

  /** MOBILE CAROUSEL - FIXED */
  const MobileCarousel = (
    <div className="lg:hidden mb-8">
      <Carousel className="w-full">
        <CarouselContent>
          {displayImages.map((img, i) => (
            <CarouselItem key={i} className="min-h-[300px] md:min-h-[450px]">
              <div className="relative w-full h-[300px] md:h-[450px]">
                {!img.src ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted-foreground/5">
                    <ImageIcon size={64} className="text-muted-foreground" />
                  </div>
                ) : (
                  <Image
                    src={img.src}
                    alt={title}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </div>
  );

  /** TECHNICAL INFO */
  const TechnicalInfo = (
    <div className="md:p-6 rounded-xl mt-10">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-2xl inline-block">
          Technical Information
          <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
        </h3>

        <div className="flex items-center gap-5">
          <span
            className={`text-sm font-semibold ${
              inchMode ? " text-muted-foreground" : "text-secondary"
            }`}
          >
            inch
          </span>
          <Switch
            checked={inchMode}
            onCheckedChange={(v) => setInchMode(v)}
            className="scale-[1.2] md:scale-[1.5] data-[state=checked]:bg-secondary"
          />
          <span
            className={`text-sm font-semibold ${
              !inchMode ? " text-muted-foreground" : "text-secondary"
            }`}
          >
            mm
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-lg">
        {technicalRows.map((row) => (
          <div key={row.key} className="flex justify-between border-b pb-2">
            <span className="font-semibold">{row.label}</span>

            <span>
              {inchMode ? (
                <span>{row.value_mm}</span>
              ) : (
                <span>{row.value_in}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------------------- HTML ---------------------- */
  console.log(product);

  return (
    <>
      {/* PAGE TOP - smaller header */}
      <div className="bg-[#f3f3f3] hidden md:flex">
        <div className="w-full max-w-[1500px] flex-col md:flex-row gap-2  px-6 sm:px-25 mx-auto flex items-center justify-between py-10">
          <div>
            <h1 className="font-bold text-3xl md:text-4xl">Product Detail</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              <span>Home</span>
              <span className="px-2 opacity-60">/</span>
              <span className="font-semibold">{rotaNo}</span>
            </div>
          </div>

          <div className="flex items-center">
            <Image
              className="sm:-mt-[1rem] mt-1"
              src="/tecdoc.png"
              alt="TecDoc"
              width={160}
              height={44}
            />
          </div>
        </div>
      </div>

      {/* MOBILE IMAGE FIRST */}
      {MobileCarousel}

      {/* MAIN GRID */}
      <div className="container px-2 md:px-25 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
          <h2 className="text-2xl md:text-6xl font-semibold text-gray-700">
            {rotaNo}
          </h2>
          <div className="text-3xl md:text-3xl font-bold">
            <span className="text-3xl font-extrabold text-secondary">
              ${effectiveDiscount ? formattedTierPrice : formattedPrice} USD
            </span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mt-2">
            {displayedLocation && (
              <div className="flex items-center gap-1 text-blue-600 font-bold">
                <Icons name="konum" />
                {displayedLocation}
              </div>
            )}
            {(() => {
              const isInStock =
                typeof displayedStock === "number"
                  ? displayedStock > 0
                  : (raw?.variants?.[0]?.inventory_quantity ?? 0) > 0;

              return (
                <div
                  className={`flex items-center gap-1 font-bold ${
                    isInStock ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isInStock ? (
                    <Icons name="stock" />
                  ) : (
                    <Icons name="x" width={20} height={20} />
                  )}

                  {isInStock
                    ? displayedStock !== undefined
                      ? `${displayedStock} in stock`
                      : "In stock"
                    : "Out of stock"}
                </div>
              );
            })()}

            <div className="flex items-center gap-1 font-bold text-orange-600">
              <Icons name="teslim" />
              3–4 DAYS
            </div>
          </div>

          {/* Payment Icons */}
          <div className="relative w-[400px] md:max-w-[40rem] h-[3rem] mt-4">
            <Image
              src="/cars.png"
              fill
              className="object-contain"
              alt="payments"
            />
          </div>

          {/* ADD TO CART */}
          <div className="mt-4">
            {(() => {
              const noStockInfo = pageMaxAvailable === undefined;
              const isGetStock = pageOutOfStock || noStockInfo;

              if (isGetStock) {
                return (
                  <button
                    onClick={() => setStockModalOpen(true)}
                    className="w-full h-14 font-bold bg-secondary text-white rounded-md hover:brightness-110 transition"
                  >
                    Get Stock
                  </button>
                );
              }

              return (
                <div className="flex w-full border-2 border-secondary rounded-md overflow-hidden">
                  <input
                    type="number"
                    min={1}
                    max={pageMaxAvailable}
                    value={qty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") return setQty("");
                      const n = Number(v);
                      const cap = pageMaxAvailable ?? Number.POSITIVE_INFINITY;
                      const parsed = Number.isNaN(n) ? 1 : n;
                      const final = Math.max(1, Math.min(parsed, cap));
                      setQty(String(final));
                    }}
                    className="w-28 h-14 px-3 text-center bg-white border-none outline-none"
                    aria-label="Quantity"
                  />
                  <Button
                    onClick={handleAddToCart}
                    className="flex-1 font-bold h-14 bg-secondary text-white"
                    disabled={addingToCart}
                  >
                    {addingToCart ? "Adding..." : "ADD TO CART"}
                  </Button>
                </div>
              );
            })()}
          </div>

          {/* Suitable for */}
          <div className="mt-10">
            <h3 className="font-bold text-2xl inline-block">
              Suitable for
              <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
            </h3>

            {(() => {
              try {
                const rawAny = raw as any;
                let brands: string[] = [];

                // 1) Direct raw.Brands field
                if (Array.isArray(rawAny?.Brands) && rawAny.Brands.length > 0) {
                  brands = rawAny.Brands.map(
                    (b: any) =>
                      b?.BrandDescription ||
                      b?.Brand ||
                      b?.MarkaDescription ||
                      "",
                  )
                    .filter(Boolean)
                    .map((s: string) => s.trim().toUpperCase());
                } else {
                  // 2) Fall back to brand metafield (array of objects)
                  const brandField = raw.metafields?.find(
                    (m: any) =>
                      /brand/i.test(m.key) ||
                      (m.namespace === "custom" && /brand/i.test(m.key)),
                  );
                  if (brandField?.value) {
                    const parsed = JSON.parse(brandField.value);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    brands = arr
                      .map(
                        (b: any) =>
                          b?.BrandDescription ||
                          b?.Brand ||
                          b?.MarkaDescription ||
                          "",
                      )
                      .filter(Boolean)
                      .map((s: string) => s.trim().toUpperCase());
                  }
                }

                const uniqBrands = Array.from(new Set(brands));

                return (
                  <div className="mt-3">
                    <p className="font-semibold text-black text-lg">
                      {uniqBrands.length > 0
                        ? uniqBrands.join(", ")
                        : ((raw as any).vendor ?? "—")}
                    </p>
                  </div>
                );
              } catch {
                return (
                  <p className="font-semibold text-black text-lg mt-3">
                    {(raw as any).vendor}
                  </p>
                );
              }
            })()}
          </div>

          {/* References */}
          <div className="mt-10">
            <h3 className="font-bold text-2xl inline-block">
              References
              <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
            </h3>

            {(() => {
              try {
                const rawAny = raw as any;

                // 1) Group OEM numbers by MarkaDescription
                const oemGrouped: Record<string, string[]> = {};
                let oems: Array<{ OemNo: string; MarkaDescription: string }> =
                  [];
                if (Array.isArray(rawAny?.Oems) && rawAny.Oems.length > 0) {
                  oems = rawAny.Oems;
                } else {
                  // Fall back to oem_info metafield
                  const oemField = raw.metafields?.find((m) =>
                    /oem_info/i.test(m.key),
                  );
                  if (oemField?.value) {
                    const parsed = JSON.parse(oemField.value);
                    oems = Array.isArray(parsed) ? parsed : [];
                  }
                }

                for (const oem of oems) {
                  const brand = String(oem.MarkaDescription || "")
                    .trim()
                    .toUpperCase();
                  const no = String(oem.OemNo || "").trim();
                  if (!brand || !no) continue;
                  if (!oemGrouped[brand]) oemGrouped[brand] = [];
                  oemGrouped[brand].push(no);
                }

                // 2) Collect competitors with Type === "View" as individual rows
                // First try direct raw.Competiters, then fall back to competitor_info metafield
                const competitorRows: { name: string; ref: string }[] = [];
                let rawCompetitors: any[] = [];
                if (
                  Array.isArray(rawAny?.Competiters) &&
                  rawAny.Competiters.length > 0
                ) {
                  rawCompetitors = rawAny.Competiters;
                } else {
                  const compField = raw.metafields?.find((m) =>
                    /competitor_info/i.test(m.key),
                  );
                  if (compField?.value) {
                    try {
                      const parsed = JSON.parse(compField.value);
                      rawCompetitors = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      rawCompetitors = [];
                    }
                  }
                }
                for (const c of rawCompetitors) {
                  if (
                    String(c?.Type || "")
                      .trim()
                      .toLowerCase() !== "view"
                  )
                    continue;
                  const name = String(c.CompetitorName || "")
                    .trim()
                    .toUpperCase();
                  const ref = String(c.ReferansView || "").trim();
                  if (!name || !ref) continue;
                  competitorRows.push({ name, ref });
                }

                const oemEntries = Object.entries(oemGrouped).sort(([a], [b]) =>
                  a.localeCompare(b),
                );

                competitorRows.sort((a, b) => a.name.localeCompare(b.name));

                if (oemEntries.length === 0 && competitorRows.length === 0) {
                  return (
                    <div className="mt-4 text-sm text-muted-foreground">
                      No references available
                    </div>
                  );
                }

                return (
                  <div className="mt-4 space-y-3 text-lg">
                    {oemEntries.map(([brand, nos]) => (
                      <div key={brand} className="flex justify-between gap-4">
                        <span className="font-semibold shrink-0">{brand}</span>
                        <span className="text-right break-all">
                          {nos.join(" - ")}
                        </span>
                      </div>
                    ))}

                    {competitorRows.map((c, i) => (
                      <div
                        key={`comp-${i}`}
                        className="flex justify-between gap-4"
                      >
                        <span className="font-semibold shrink-0">{c.name}</span>
                        <span className="text-right break-all">{c.ref}</span>
                      </div>
                    ))}
                  </div>
                );
              } catch {
                return (
                  <div className="mt-4 text-sm text-muted-foreground">
                    No references available
                  </div>
                );
              }
            })()}
          </div>

          {/* Mobile tech info */}
          {hasTechnicalInfo ? (
            <div className="lg:hidden">{TechnicalInfo}</div>
          ) : null}
        </div>
        {/* RIGHT SIDE DESKTOP */}
        <div className="hidden lg:flex flex-col gap-6">
          {/* DESKTOP CAROUSEL — FIXED */}
          <Carousel className="w-full">
            <CarouselContent>
              {displayImages.map((img, i) => (
                <CarouselItem key={i} className="min-h-[450px]">
                  <div className="relative w-full h-[450px]">
                    {!img.src ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted-foreground/5">
                        <ImageIcon
                          size={80}
                          className="text-muted-foreground"
                        />
                      </div>
                    ) : (
                      <Image
                        src={img.src}
                        alt={title}
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>

          {hasTechnicalInfo ? TechnicalInfo : null}
        </div>
      </div>

      {/* COMPONENTS (parts used to build this product) */}
      {(componentsLoading || componentsProducts.length > 0) && (
        <div className="container px-4 md:px-25 mt-10 w-full">
          <h3 className="font-bold text-2xl inline-block">
            Components
            <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
          </h3>

          {componentsLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner label="Loading components..." size={30} />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:justify-start items-start gap-4 mt-6">
              {componentsProducts.map(({ prod, qty }) => {
                const cp = prod as IProduct;
                const img = (() => {
                  const imgs = cp.raw.images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    if (imgs.length > 1) {
                      const matched = imgs.find((it) =>
                        /\/files\/\d{4,}/.test(String((it as any)?.src || "")),
                      );
                      if (matched) return String((matched as any).src || "");
                    }
                    return String((imgs[0] as any)?.src || "");
                  }
                  return "";
                })();
                const cpRota = extractRotaNo(cp.raw.metafields);

                const href = `/products/${cp.shopifyId ?? cp._id}`;
                const compTech = getTechnicalRows(cp.raw.metafields || []);

                return (
                  <div
                    key={cp._id}
                    className="block bg-white rounded-lg p-4 max-w-xs"
                  >
                    <div className="w-full h-44 relative mb-4 overflow-hidden rounded-lg">
                      {!img ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted-foreground/5 rounded-lg">
                          <ImageIcon
                            size={48}
                            className="text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <Image
                          src={img}
                          alt={cp.raw.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="text-xl font-bold">
                        <a href={href} className="hover:underline">
                          {cpRota}
                        </a>{" "}
                        {qty > 1 && (
                          <span className="text-base font-normal">
                            (X {qty})
                          </span>
                        )}
                      </div>
                      <div className="font-medium">{cp.raw.title}</div>
                    </div>

                    {compTech.length > 0 && (
                      <div className="mt-3">
                        <div className="font-semibold inline-block text-xl border-b-2 border-secondary">
                          Technical Information
                        </div>

                        <div className="mt-3 text-sm grid grid-cols-2 gap-y-2">
                          {compTech.slice(0, 8).map((row: TechInfoRow) => (
                            <div
                              key={row.key}
                              className="flex justify-between col-span-2 border-b border-muted/20 py-2"
                            >
                              <span className="font-medium">{row.label}</span>
                              <span className="text-right">
                                {row.value_mm || row.value_in}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUITABLE MODELS */}
      {SUITABLE_MODELS.length > 0 && (
        <div className="container px-4 md:px-25 mt-20 mb-[5rem] w-full">
          <h3 className="font-bold text-2xl inline-block">
            Suitable Models
            <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
          </h3>

          {/* Desktop header */}
          <div className="hidden md:flex border-b pb-3 text-sm font-semibold text-gray-700 mt-4">
            <span className="flex-1">Brand</span>
            <span className="flex-2">Model</span>
            <span className="flex-[0.7]">Year</span>
            <span className="flex-[0.7]">Kw</span>
            <span className="flex-[0.7]">Hp</span>
            <span className="flex-[0.8]">Class</span>
            <span className="flex-1">Type</span>
          </div>

          {SUITABLE_MODELS.map((row, i) => (
            <div key={i}>
              {/* Desktop */}
              <div className="hidden md:flex bg-gray-100 py-4 px-3 mt-3 rounded-md text-sm">
                <span className="flex-1 font-semibold">{row.brand}</span>
                <span className="flex-2 font-semibold whitespace-pre-line">
                  {row.model}
                </span>
                <span className="flex-[0.7]">{row.year}</span>
                <span className="flex-[0.7]">{row.kw}</span>
                <span className="flex-[0.7] font-semibold">{row.hp}</span>
                <span className="flex-[0.8]">{row.className}</span>
                <span className="flex-1 font-semibold">{row.type}</span>
              </div>

              {/* Mobile */}
              <div className="md:hidden bg-gray-100 p-4 rounded-lg mt-4 text-sm space-y-2">
                <div className="font-bold">{row.brand}</div>
                <div className="font-semibold whitespace-pre-line leading-tight">
                  {row.model}
                </div>

                <div className="flex justify-between">
                  <b>Year</b>
                  <span>{row.year}</span>
                </div>
                <div className="flex justify-between">
                  <b>Kw</b>
                  <span>{row.kw}</span>
                </div>
                <div className="flex justify-between">
                  <b>Hp</b>
                  <span>{row.hp}</span>
                </div>
                <div className="flex justify-between">
                  <b>Class</b>
                  <span>{row.className}</span>
                </div>
                <div className="flex justify-between">
                  <b>Type</b>
                  <span>{row.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* GET STOCK DIALOG */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Request stock:{" "}
              <span className="text-secondary">
                {product?.raw?.title ?? rotaNo}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            <p className="text-sm font-semibold text-gray-700 mb-2">Details</p>
            <textarea
              id="stock-request-message"
              rows={4}
              defaultValue={`I'm looking for: ${rotaNo}`}
              className="w-full border border-gray-200 rounded-md p-3 text-sm text-secondary outline-none resize-y"
            />
          </div>

          <DialogFooter className="flex gap-2 justify-end mt-2">
            <Button
              onClick={async () => {
                try {
                  const ta = document.getElementById(
                    "stock-request-message",
                  ) as HTMLTextAreaElement | null;
                  const message = ta ? ta.value : `I'm looking for ${rotaNo}`;
                  const resp = await fetch(`/api/requests/product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      query: rotaNo,
                      message,
                    }),
                  });
                  if (resp.ok) {
                    toast.success("Request submitted");
                    setStockModalOpen(false);
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
            <Button variant="ghost" onClick={() => setStockModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
