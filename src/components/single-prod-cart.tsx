/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";
import useSessionStore from "@/store/session-store";
import Icons from "./icons";
import { toast } from "sonner";

interface ProductCardProps {
  id: string | number;
  code: string;
  title: string;
  price: number;
  image: string;
  oems?: string[]; // OEM list
  location?: string;
  inStock?: boolean;
  stock?: number | string;
  variantId?: string;
  matchType?: "exact" | "partial" | undefined;
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
}: ProductCardProps) {
  const addToCart = useSessionStore((s) => s.addToCart);

  // use string so user can clear the field while typing (e.g. replace "1" with "300")
  const [qty, setQty] = useState<string>("1");

  return (
    <Card className="shadow-none flex flex-col gap-0 bg-transparent rounded-md w-70 p-0 border-2">
      <div className="relative w-68 rounded-t-[inherit] aspect-square">
        {/* Match badge overlay (top-left) */}
        {matchType ? (
          <div
            className="absolute left-3 top-3 z-10 px-2 py-1 rounded text-sm font-semibold"
            style={{
              background: matchType === "exact" ? "#def7ec" : "#fff4e6",
              color: matchType === "exact" ? "#065f46" : "#b45309",
            }}
          >
            {matchType === "exact" ? "Exact match" : "Partial match"}
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
        <Link href={`/products/${id}`} className="hover:underline">
          <div>
            <span className="font-semibold text-2xl">{title}</span>
            <p className=" font-medium ">{code}</p>
          </div>
        </Link>

        {/* Price under title */}
        <div className="mt-1">
          <span className="text-lg font-bold text-secondary">
            {Number(price).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USD
          </span>
        </div>

        {/* OEM dynamic list (first 3) */}
        {oems && oems.length > 0 ? (
          <div className="relative h-[60px] overflow-hidden text-sm leading-[1.35] pr-3">
            <div className="absolute right-0 top-0 w-[4px] h-full bg-[#f5a623] rounded-full"></div>
            {oems.slice(0, 3).map((oem, i) => (
              <p key={i} className="font-semibold">
                <span className="font-normal">{oem}</span>
              </p>
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
