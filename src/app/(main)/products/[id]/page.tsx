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

const SUITABLE_MODELS: SuitableModel[] = [
  {
    brand: "HENDRICKSON",
    model: "FIREMAAX EX – 240–480 AIR\nSUSPENSION",
    year: "-",
    kw: "-",
    hp: "US",
    className: "-",
    type: "TRAILER",
  },
  {
    brand: "HENDRICKSON",
    model: "FIREMAAX EX – 270–540 AIR\nSUSPENSION",
    year: "-",
    kw: "-",
    hp: "US",
    className: "-",
    type: "TRAILER",
  },
];

/* ---------------------- MAIN PAGE ---------------------- */

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const addToCart = useSessionStore((s) => s.addToCart);
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
              .trim() === normalized
        );
        const discount = found ? Number(found.discountPercentage) : null;
        if (mounted) {
          setPrismaDiscount(discount);
          console.log(
            `[product-page] prisma discountPercentage for ${tag}:`,
            discount
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

        const compsField = product.raw?.metafields?.find((m) =>
          /comp$/i.test(m.key)
        );
        if (!compsField) {
          if (mounted) setComponentsProducts([]);
          return;
        }

        let parsed: unknown[] = [];
        try {
          parsed = JSON.parse(compsField.value) as unknown[];
        } catch {
          parsed = [];
        }

        const results: { prod: IProduct; qty: number }[] = [];

        for (const item of parsed) {
          const obj = item as Record<string, unknown>;
          const compNo = String(
            obj.ComponentNo ?? obj.RotaNo ?? obj.Component ?? ""
          ).trim();
          if (!compNo) continue;

          try {
            const resp = await fetch(
              `/api/products/gets?search=${encodeURIComponent(compNo)}`
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
          const q = Number(
            firstVariant?.inventory_quantity ??
              firstVariant?.inventory_quantity ??
              0
          );
          if (!Number.isNaN(q)) avail = q;
        }

        if (avail !== undefined && desiredQty > avail) {
          desiredQty = avail;
          setQty(String(desiredQty));
          toast.warning("Quantity capped to available stock");
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
        quantity: Number(qty || 1),
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
        `/api/products/gets?shopifyId=${id}`
      );
      const shopifyJson = await attemptByShopify.json().catch(() => null);
      let found = shopifyJson?.results?.[0] ?? null;

      // Fallback: if not found, treat param as variant id and try that
      if (!found) {
        const attemptByVariant = await fetch(
          `/api/products/gets?variantId=${id}`
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
            0
        );
        displayedStock = Number.isNaN(qty) ? undefined : qty;
      }
    }
  } catch {
    // ignore
  }
  const image = raw.images?.[0]?.src ?? "";
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
        (m.namespace === "custom" && /(oem|brand)/i.test(m.key))
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
          (m.namespace === "custom" && /(technical|tech)/i.test(m.key))
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
            obj.Technicalmm ?? obj.TechnicalMM ?? obj.Technical ?? ""
          ),
          value_in: asString(
            obj.Technicalinch ?? obj.TechnicalInch ?? obj.Technicalinch ?? ""
          ),
        } as TechInfoRow;
      });

      return rows.length ? rows : TECH_INFO;
    } catch {
      return TECH_INFO;
    }
  };

  const technicalRows = getTechnicalRows(raw.metafields);
  const hasTechnicalInfo = (() => {
    try {
      const candidate = raw.metafields?.find(
        (m: any) =>
          /(technical|tech|technical_info)/i.test(m.key) ||
          (m.namespace === "custom" && /(technical|tech)/i.test(m.key))
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
          {(raw.images.length ? raw.images : [{ src: image }]).map((img, i) => (
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
    <div className="w-full">
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
            <div className="flex items-center gap-1 text-blue-600 font-bold">
              <Icons name="konum" />
              {displayedLocation ?? "—"}
            </div>
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
            <div
              className={`flex w-full border-2 ${
                pageOutOfStock
                  ? "border-muted-foreground/30"
                  : "border-secondary"
              } rounded-md overflow-hidden`}
            >
              {(() => {
                const maxAvailable = pageMaxAvailable;
                const outOfStock = pageOutOfStock;

                return (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={maxAvailable}
                      disabled={outOfStock}
                      value={qty}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") return setQty("");
                        const n = Number(v);
                        const cap = maxAvailable ?? Number.POSITIVE_INFINITY;
                        const parsed = Number.isNaN(n) ? 1 : n;
                        const final = Math.max(1, Math.min(parsed, cap));
                        setQty(String(final));
                      }}
                      className="w-28 h-14 px-3 text-center bg-white border-none outline-none disabled:opacity-50"
                      aria-label="Quantity"
                    />

                    <Button
                      onClick={handleAddToCart}
                      className={`flex-1 font-bold h-14 ${
                        outOfStock
                          ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                          : "bg-secondary text-white"
                      }`}
                      disabled={addingToCart || outOfStock}
                    >
                      {outOfStock
                        ? "Out of Stock"
                        : addingToCart
                        ? "Adding..."
                        : "ADD TO CART"}
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Suitable for */}
          <div className="mt-10">
            <h3 className="font-bold text-2xl inline-block">
              Suitable for
              <span className="block w-full h-[3px] bg-secondary rounded-full mt-1"></span>
            </h3>

            {(() => {
              try {
                const brandField = raw.metafields?.find(
                  (m: any) =>
                    /brand/i.test(m.key) ||
                    (m.namespace === "custom" && /brand/i.test(m.key))
                );

                const modelsField = raw.metafields?.find(
                  (m: any) =>
                    /models?/i.test(m.key) ||
                    (m.namespace === "custom" && /models?/i.test(m.key))
                );

                let brand: string | undefined = undefined;
                let models: string[] = [];

                const safeStringify = (v: any): string => {
                  if (v == null) return "";
                  if (typeof v === "string") return v;
                  if (Array.isArray(v)) {
                    // join array elements (prefer primitive values or try to stringify objects)
                    return v
                      .map((it: any) =>
                        typeof it === "object" ? safeStringify(it) : String(it)
                      )
                      .filter(Boolean)
                      .join(", ");
                  }

                  if (typeof v === "object") {
                    // prefer common named properties, fallback to JSON
                    const keysToTry = [
                      "BrandDescription",
                      "Brand",
                      "MarkaDescription",
                      "Brand1",
                      "Name",
                      "name",
                      "brand",
                      "description",
                      "Manufacturer",
                    ];

                    for (const k of keysToTry) {
                      if (v[k] != null && String(v[k]) !== "")
                        return String(v[k]);
                    }

                    return JSON.stringify(v);
                  }

                  return String(v);
                };

                if (brandField && typeof brandField.value === "string") {
                  try {
                    const parsed = JSON.parse(brandField.value);
                    if (Array.isArray(parsed) && parsed[0]) {
                      brand = safeStringify(parsed[0]);
                    } else if (parsed && typeof parsed === "object") {
                      brand = safeStringify(parsed);
                    } else {
                      brand = String(brandField.value);
                    }
                  } catch {
                    brand = String(brandField.value);
                  }
                }

                if (modelsField && typeof modelsField.value === "string") {
                  try {
                    const parsed = JSON.parse(modelsField.value);
                    if (Array.isArray(parsed))
                      models = parsed
                        .map((x: any) => safeStringify(x))
                        .filter(Boolean);
                    else
                      models = String(modelsField.value)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                  } catch {
                    models = String(modelsField.value)
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                  }
                }

                return (
                  <div className="mt-3">
                    <p className="font-semibold text-black text-lg">
                      {brand ?? raw.vendor}
                    </p>
                    {models.length > 0 && (
                      <div className="mt-2 text-sm space-y-1">
                        {models.map((m: string, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span className="font-semibold">{m}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } catch {
                return (
                  <p className="font-semibold text-black text-lg mt-3">
                    {raw.vendor}
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
                const compField = raw.metafields?.find((m) =>
                  /competitor_info/i.test(m.key)
                );
                const compsField = raw.metafields?.find((m) =>
                  /comp$/i.test(m.key)
                );

                const competitors = compField
                  ? (JSON.parse(compField.value) as unknown[])
                  : ([] as unknown[]);
                const components = compsField
                  ? (JSON.parse(compsField.value) as unknown[])
                  : ([] as unknown[]);

                const getFirst = (
                  obj: Record<string, unknown>,
                  keys: string[]
                ) => {
                  for (const k of keys) {
                    const v = obj[k];
                    if (v != null && String(v) !== "") return String(v);
                  }
                  return "";
                };

                return (
                  <div className="mt-4 space-y-3 text-lg">
                    {competitors.length > 0 && (
                      <div>
                        {competitors.map((c, i) => {
                          const obj = c as Record<string, unknown>;
                          return (
                            <div
                              key={`comp-${i}`}
                              className="flex justify-between"
                            >
                              <span className="font-semibold">
                                {getFirst(obj, [
                                  "CompetitorName",
                                  "Competitor",
                                  "CompetitorId",
                                ])}
                              </span>
                              <span>
                                {getFirst(obj, ["ReferansView", "Referans"])}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {components.length > 0 && (
                      <div>
                        {components.map((c, i) => {
                          const obj = c as Record<string, unknown>;
                          return (
                            <div
                              key={`c-${i}`}
                              className="flex justify-between"
                            >
                              <span className="font-semibold">Component</span>
                              <span>
                                {getFirst(obj, ["ComponentNo", "ReferansView"])}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!competitors.length && !components.length && (
                      <div className="text-sm text-muted-foreground">
                        No references available
                      </div>
                    )}
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
              {(raw.images.length ? raw.images : [{ src: image }]).map(
                (img, i) => (
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
                )
              )}
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
                const img = cp.raw.images?.[0]?.src ?? "";
                const cpRota = extractRotaNo(cp.raw.metafields);

                const href = `/products/${cp.shopifyId ?? cp._id}`;
                const compTech = getTechnicalRows(cp.raw.metafields || []);

                return (
                  <div
                    key={cp._id}
                    className="block bg-white rounded-lg p-4 max-w-xs"
                  >
                    <div className="w-full h-44 relative mb-4">
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
    </div>
  );
}
