"use client";

import Image from "next/image";
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

  const [product, setProduct] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [inchMode, setInchMode] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  // use string so user can clear the input while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");

  const handleAddToCart = async () => {
    setAddingToCart(true);

    try {
      // Shopify variant ID'yi al (GID formatında olmalı)
      const variantId = `gid://shopify/ProductVariant/${raw.variants[0].id}`;

      // Call server API to add to Shopify cart
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

      // Update local session store for immediate UI feedback
      await addToCart({
        id: rotaNo || String(id),
        title,
        price: Number(price),
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
  const image = raw.images?.[0]?.src ?? "/placeholder.png";
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

  /* ---------------------- COMPONENTS ---------------------- */

  /** MOBILE CAROUSEL - FIXED */
  const MobileCarousel = (
    <div className="lg:hidden mb-8">
      <Carousel className="w-full">
        <CarouselContent>
          {(raw.images.length ? raw.images : [{ src: image }]).map((img, i) => (
            <CarouselItem key={i} className="min-h-[300px] md:min-h-[450px]">
              <div className="relative w-full h-[300px] md:h-[450px]">
                <Image
                  src={img.src}
                  alt={title}
                  fill
                  className="object-contain"
                />
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
          <p className="text-3xl md:text-3xl font-bold">
            ${formattedPrice} USD
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="flex items-center gap-1 text-blue-600 font-bold">
              <Icons name="konum" />
              CHICAGO
            </div>
            <div className="flex items-center gap-1 font-bold text-green-600">
              <Icons name="stock" />
              IN STOCK
            </div>
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
            <div className="flex w-full border-2 border-secondary rounded-md overflow-hidden">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setQty("");
                  const n = Number(v);
                  setQty(String(Math.max(1, Number.isNaN(n) ? 1 : n)));
                }}
                className="w-28 h-14 px-3 text-center bg-white border-none outline-none"
                aria-label="Quantity"
              />

              <Button
                onClick={handleAddToCart}
                className="flex-1 bg-secondary text-white font-bold h-14"
                disabled={addingToCart}
              >
                {addingToCart ? "Adding..." : "ADD TO CART"}
              </Button>
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
                // parse applications or brand_info metafields
                const appsField = raw.metafields?.find((m) =>
                  /applications?/i.test(m.key)
                );
                const brandField = raw.metafields?.find((m) =>
                  /brand_info/i.test(m.key)
                );

                let brand = raw.vendor ?? "";
                if (brandField) {
                  const parsed = JSON.parse(brandField.value) as unknown[];
                  if (Array.isArray(parsed) && parsed[0]) {
                    const obj = parsed[0] as Record<string, unknown>;
                    brand = String(obj.BrandDescription ?? brand);
                  }
                }

                const models: string[] = [];
                if (appsField) {
                  const parsedApps = JSON.parse(appsField.value) as unknown[];
                  if (Array.isArray(parsedApps)) {
                    for (const item of parsedApps) {
                      const a = item as Record<string, unknown>;
                      const md = String(
                        a.ModelDescription ?? a.Model2 ?? a.Model ?? ""
                      );
                      if (md && !models.includes(md)) models.push(md);
                      if (models.length >= 6) break;
                    }
                  }
                }

                return (
                  <div className="mt-3">
                    <p className="font-semibold text-black text-lg">{brand}</p>
                    {models.length > 0 && (
                      <div className="mt-2 text-sm space-y-1">
                        {models.map((m, i) => (
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
          <div className="lg:hidden">{TechnicalInfo}</div>
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
                      <Image
                        src={img.src}
                        alt={title}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </CarouselItem>
                )
              )}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>

          {TechnicalInfo}
        </div>
      </div>

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
