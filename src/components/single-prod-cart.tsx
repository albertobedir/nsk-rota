/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";
import useSessionStore from "@/store/session-store";
import Icons from "./icons";
import { Check } from "lucide-react";
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
}: ProductCardProps) {
  const addToCart = useSessionStore((s) => s.addToCart);

  // use string so user can clear the field while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");

  const isExact = matchType === "exact";
  const isPartial = matchType === "partial";

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
    } catch (e) {
      /* ignore */
    }
    return String(id ?? "unknown");
  })();

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
    <Card className="shadow-none bg-white flex flex-col gap-0 rounded-md w-full p-0 border-2">
      <div className="relative w-full rounded-t-[inherit] aspect-square">
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

        <Image
          alt={title}
          fill
          className="rounded-[inherit] object-contain"
          src={image}
        />
      </div>

      <div className="flex flex-col bg-white gap-2 p-3">
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

            <p className="text-sm font-medium text-gray-700">{title}</p>
          </div>
        </Link>

        {/* Price under title */}
        <div className="mt-1">
          <span className="text-base md:text-lg font-bold text-secondary">
            {Number(price).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USD
          </span>
        </div>

        {/* OEM dynamic list (first 3) */}
        {oems && oems.length > 0 ? (
          <div className="relative h-[60px] overflow-y-scroll text-sm leading-[1.35] pr-3">
            <div className="absolute right-0 top-0 w-[4px] h-full  rounded-full"></div>
            {oems.slice(0, 3).map((oem, i) => (
              <div key={i} className="font-semibold">
                {renderOemEntry(oem)}
              </div>
            ))}
          </div>
        ) : null}

        {/* Dynamic badges (location, stock) */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 text-blue-600 font-bold">
            <Icons name="konum" />
            {location || "—"}
          </div>
          <div
            className={`flex items-center gap-1 font-bold ${
              inStock ? "text-green-600" : "text-red-600"
            }`}
          >
            <Icons name="stock" />
            {stock !== undefined && stock !== null
              ? (() => {
                  const n = Number(stock as any);
                  return !Number.isNaN(n) ? `${n} in stock` : String(stock);
                })()
              : inStock
              ? "In stock"
              : "Out of stock"}
          </div>
        </div>

        {/* Quantity + Add to cart (split control) */}
        <div className="mt-2">
          <div className="flex w-full border-2 border-secondary rounded-md overflow-hidden">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  // allow clearing the input
                  setQty("");
                  return;
                }
                // keep a numeric string with minimum 1
                const n = Number(v);
                setQty(String(Math.max(1, Number.isNaN(n) ? 1 : n)));
              }}
              className="w-20 h-10 px-3 text-center bg-white border-none outline-none"
              aria-label="Quantity"
            />

            <button
              onClick={async () => {
                try {
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
                    price: Number(price),
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
              className="
    flex-1 bg-secondary text-white font-bold h-10
    transition duration-150
    hover:brightness-110
    active:brightness-90 active:scale-[0.98]
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40
  "
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
