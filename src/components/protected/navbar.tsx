"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import Logo from "../icons/logo";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Menu,
  Search,
} from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

import { useProductsSearch } from "@/hooks/query-hook";
import { useProductsStore } from "@/store/products-store";

export default function Navbar() {
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [value, setValue] = useState("");

  const setProducts = useProductsStore((s) => s.setProducts);
  const setTotal = useProductsStore((s) => s.setTotal);
  // normalized search value
  const searchQuery = value.trim().replace(/\s+/g, ",");

  const { data, refetch, isFetching } = useProductsSearch(searchQuery);

  useEffect(() => {
    if (data?.results) {
      setProducts(data.results);
      setTotal(data.total);
    }
  }, [data, setProducts, setTotal]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === "single") {
      if (e.key === " ") {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter") {
        refetch();
      }
    }

    if (mode === "multiple") {
      if (e.key === " ") {
        e.preventDefault();
        setValue((prev) => (prev + " ").trim() + " ");
      }

      if (e.key === "Enter") {
        e.preventDefault();
        refetch();
      }
    }
  };

  return (
    <nav>
      <aside className="flex flex-col items-end">
        <div className="w-full h-[0.3rem] bg-primary"></div>
        <div className="px-13">
          <Link
            className="text-white bg-primary p-4 rounded-b-4xl"
            href="https://nskgroup.com.tr"
          >
            Corporite Website
          </Link>
        </div>
      </aside>

      <main className="flex w-full shadow shadow-card justify-between px-[4rem] items-center py-5">
        <Logo size={0.9} className="text-primary" />

        {/* SEARCH AREA */}
        <div className="flex justify-center items-center gap-2">
          <Card className="bg-white gap-0 p-0 rounded-lg  flex flex-row">
            {/* SELECTOR */}
            <div className="text-sm">
              <div
                className={`py-0.5 px-3 rounded-tl-md flex gap-2 items-center cursor-pointer ${
                  mode === "single"
                    ? "bg-secondary text-white"
                    : "bg-white text-black"
                }`}
                onClick={() => setMode("single")}
              >
                <Search className="size-4" />
                <span>Single Search</span>
                <ChevronRight />
              </div>

              <div
                className={`py-0.5 px-3 rounded-bl-md flex gap-2 items-center cursor-pointer ${
                  mode === "multiple"
                    ? "bg-secondary text-white"
                    : "bg-white text-black"
                }`}
                onClick={() => setMode("multiple")}
              >
                <Search className="size-4" />
                <span>Multiple Search</span>
                <ChevronRight />
              </div>
            </div>

            {/* INPUT */}
            <div className="relative flex-1 w-[27rem]">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-full outline-none border-none"
                placeholder={
                  mode === "single"
                    ? "OEM Kodu ile arayın"
                    : "Birden fazla değer girin (boşluk ile ayır)"
                }
              />

              <div
                className="absolute bg-secondary right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-white cursor-pointer"
                onClick={() => refetch()}
              >
                <Search size={15} />
              </div>

              {isFetching && (
                <span className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  loading...
                </span>
              )}
            </div>
          </Card>

          <div>credit</div>
        </div>

        <div className="flex justify-center text-primary items-center gap-4">
          <FileText />
          <div className="flex items-center">
            <span>ENG</span>
            <ChevronDown />
          </div>
          <Menu />
        </div>
      </main>
    </nav>
  );
}
