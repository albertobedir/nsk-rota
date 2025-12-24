"use client";

import React, { useState } from "react";
import { Card } from "./ui/card";
import Image from "next/image";
import Link from "next/link";
import useSessionStore from "@/store/session-store";

interface ProductCardProps {
  id: string | number;
  code: string;
  title: string;
  price: number;
  image: string;
  oems?: string[]; // OEM list
  location?: string;
  inStock?: boolean;
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
}: ProductCardProps) {
  const addToCart = useSessionStore((s) => s.addToCart);

  const [qty, setQty] = useState<number>(1);

  return (
    <Card className="shadow-none flex flex-col gap-0 bg-transparent rounded-md w-52 p-0">
      <div className="relative w-52 rounded-t-[inherit] aspect-square">
        {/* TOP BADGES: icons only (pin + stock) */}
        <div className="absolute left-3 top-3 flex items-center gap-2 z-10">
          {location && (
            <div className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-[#0b66ff]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
                  stroke="#0b66ff"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="9" r="2" fill="#0b66ff" />
              </svg>
            </div>
          )}

          <div
            className={`w-10 h-10 flex items-center justify-center rounded-full ${
              inStock
                ? "bg-green-50 text-green-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {inStock ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="#16a34a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="#6b7280"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
        <Image
          alt={title}
          fill
          className="rounded-[inherit] object-cover"
          src={image}
        />
      </div>

      <div className="flex flex-col bg-white gap-2 p-3">
        {/* Product Title */}
        <Link href={`/products/${id}`} className="hover:underline">
          <div>
            <p className="font-semibold text-2xl">{code}</p>
            <span className="font-medium">{title}</span>
          </div>
        </Link>

        {/* Price under title */}
        <div className="mt-1">
          <span className="text-lg font-bold text-secondary">
            {price.toFixed(3)} USD
          </span>
        </div>

        {/* OEM STATIC DATA */}
        <div className="relative h-[60px] overflow-hidden text-sm leading-[1.35] pr-3">
          <div className="absolute right-0 top-0 w-[4px] h-full bg-[#f5a623] rounded-full"></div>

          <p className="font-semibold">
            NISSAN : <span className="font-normal">4016000QAB</span>
          </p>
          <p className="font-semibold">
            OPEL : <span className="font-normal">45000254 9160554</span>
          </p>
          <p className="font-semibold">
            RENAULT : <span className="font-normal">7700312851</span>
          </p>
        </div>

        {/* Quantity + Add to cart (split control) */}
        <div className="mt-2">
          <div className="flex w-full border-2 border-secondary rounded-md overflow-hidden">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              className="w-20 h-10 px-3 text-center bg-white border-none outline-none"
              aria-label="Quantity"
            />

            <button
              onClick={() =>
                addToCart({
                  id: String(code),
                  title,
                  price: Number(price),
                  image,
                  quantity: qty,
                  variantId: "",
                })
              }
              className="flex-1 bg-secondary text-white font-bold h-10"
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
