"use client";

import React from "react";
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
}

export default function SingleProdCard({
  id,
  code,
  title,
  price,
  image,
  oems = [],
}: ProductCardProps) {
  const addToCart = useSessionStore((s) => s.addToCart);

  return (
    <Card className="shadow-none flex flex-col gap-0 bg-transparent rounded-md w-60 p-0">
      <div className="relative w-60 rounded-t-[inherit] aspect-square">
        <Image
          alt={title}
          fill
          className="rounded-[inherit] object-cover"
          src={image}
        />
      </div>

      <div className="flex flex-col bg-white gap-2 p-4">
        {/* Product Title */}
        <Link href={`/products/${id}`} className="hover:underline">
          <div>
            <p className="font-semibold text-2xl">{code}</p>
            <span className="font-medium">{title}</span>
          </div>
        </Link>

        {/* OEM STATIC DATA */}
        <div className="relative h-[70px] overflow-hidden text-sm leading-[1.35] pr-3">
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

        {/* Price & Add */}
        <div className="flex border-2 justify-center items-center w-full bg-white border-secondary rounded-md">
          <div className="px-[2rem] text-muted-foreground">1</div>
          <button className="p-3 bg-secondary text-white flex-1 font-bold cursor-pointer">
            {price.toFixed(3)} USD
          </button>
        </div>
      </div>
    </Card>
  );
}
