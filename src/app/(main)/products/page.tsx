/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import SingleProdCard from "@/components/single-prod-cart";
import { useProductsStore } from "@/store/products-store";
import { Button } from "@/components/ui/button";
import { Search, Share2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const perPage = 12;

  const { products, total, fetchProducts, searchTerm } = useProductsStore();

  const [filters, setFilters] = useState({
    brand: "",
    model: "",
    type: "",
    desc: "",
    stock: "",
  });

  const [options, setOptions] = useState<{
    brand: string[];
    model: string[];
    type: string[];
    desc: string[];
    stock: string[];
  }>({ brand: [], model: [], type: [], desc: [], stock: [] });

  const totalPages = Math.ceil(total / perPage);

  useEffect(() => {
    // On mount: fetch dynamic filter options and restore any URL params.
    const fetchOptions = async () => {
      try {
        const res = await fetch("/api/products/options");
        const json = await res.json();
        if (json?.ok && json.options) setOptions(json.options);
      } catch (e) {
        // ignore — we'll fall back to static lists below
      }

      // restore filters from URL if present
      try {
        const params = new URLSearchParams(window.location.search);
        const restore: any = {};
        for (const k of ["brand", "model", "type", "desc", "stock"]) {
          const v = params.get(k);
          if (v) restore[k] = v;
        }
        const p = params.get("page");
        if (Object.keys(restore).length)
          setFilters((prev) => ({ ...prev, ...restore }));
        if (p) setPage(Number(p));
      } catch (e) {
        /* ignore */
      }
    };

    fetchOptions();

    // If there's an active searchTerm (coming from another page),
    // don't override it by fetching the default product list on mount.
    if (searchTerm && searchTerm.trim() !== "") return;

    // initial load (no filter-auto-fetch): fetch current page with current filters
    fetchProducts(page, perPage, filters);
    // Only re-run when page or searchTerm changes — filters won't auto-trigger searches
  }, [page, searchTerm, fetchProducts]);

  const clearAllFilters = () => {
    setFilters({
      brand: "",
      model: "",
      type: "",
      desc: "",
      stock: "",
    });
  };

  const applyFilters = async (pageNum = 1) => {
    setPage(pageNum);

    // update URL params so link/share reflects filters
    try {
      const params = new URLSearchParams();
      if (filters.brand) params.set("brand", filters.brand);
      if (filters.model) params.set("model", filters.model);
      if (filters.type) params.set("type", filters.type);
      if (filters.desc) params.set("desc", filters.desc);
      if (filters.stock) params.set("stock", filters.stock);
      params.set("page", String(pageNum));
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    } catch (e) {
      /* ignore */
    }

    // fetch with current filters
    await fetchProducts(pageNum, perPage, filters);
  };

  return (
    <div className="w-full">
      {/* PAGE HEADER */}
      <div className="bg-[#f3f3f3] py-10">
        <div className="w-full max-w-[1540px]  px-6 md:px-27 mx-auto">
          <h1 className="font-bold text-center sm:text-start text-4xl md:text-5xl text-[#1f1f1f]">
            Product Search
          </h1>

          {/* breadcrumb + badge inside header */}
          <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-[#1f1f1f] font-semibold">Home</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f] font-semibold">Products</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f]">Product Search</span>
            </div>
            <Image
              className="sm:-mt-[5rem] mt-5"
              src="/tecdoc.png"
              alt="TecDoc Data Supplier"
              width={180}
              height={52}
              priority
            />
          </div>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="mx-auto w-full sm:w-[50%] max-w-[1540px] px-6 mt-20 mb-12 flex flex-col gap-8">
        {/* FILTER SELECTS */}
        <div
          className="
          grid grid-cols-1 
          sm:grid-cols-2 
          md:grid-cols-3 
          lg:grid-cols-5
          gap-4 w-full
        "
        >
          {[
            {
              key: "brand",
              label: "Brand",
              options: ["HENDRICKSON", "MERCEDES", "SCANIA"],
            },
            { key: "model", label: "Model", options: ["ACTROS", "AXOR", "XF"] },
            {
              key: "type",
              label: "Type",
              options: ["TRUCK", "TRAILER", "BUS"],
            },
            {
              key: "desc",
              label: "Description",
              options: ["STEERING", "ROD", "ARM"],
            },
          ].map((f) => (
            <Select
              key={f.key}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, [f.key]: v }))
              }
              value={filters[f.key as keyof typeof filters]}
            >
              <SelectTrigger className="w-full h-[52px] bg-[#f7f7f7] text-[16px] rounded-md px-4">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((opt) => (
                  <SelectItem
                    key={opt}
                    value={opt}
                    className="text-[15px] py-2"
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* STOCK SWITCH (no card) */}
          <div className="flex items-center bg justify-start gap-3">
            <span className="hidden sm:inline text-[15px] text-[#6f6f6f] font-medium scale-120">
              Stock
            </span>
            <Switch
              checked={filters.stock === "IN"}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, stock: checked ? "IN" : "" }))
              }
            />
          </div>
        </div>

        {/* BUTTONS */}
        <div
          className="
          grid 
          grid-cols-1 
          sm:grid-cols-2 
          md:grid-cols-3 
          gap-4 
          w-full
        "
        >
          <Button
            className="bg-secondary text-white font-semibold h-[52px] text-[16px] flex gap-2 justify-center"
            onClick={() => applyFilters(1)}
          >
            Find Product <Search size={18} />
          </Button>

          <Button
            className="bg-secondary text-white font-semibold h-[52px] text-[16px] flex gap-2 justify-center"
            onClick={() => {
              clearAllFilters();
              // apply cleared filters immediately
              setTimeout(() => applyFilters(1), 0);
            }}
          >
            Clear Selections <X size={18} />
          </Button>

          <Button
            className="bg-secondary text-white font-semibold h-[52px] text-[16px] flex gap-2 justify-center"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            Copy link to share <Share2 size={18} />
          </Button>
        </div>
      </div>
      <div className="flex justify-center items-center w-full">
        {searchTerm ? (
          <p className="text-lg font-medium">
            search term: &quot;{searchTerm}&quot;
          </p>
        ) : (
          <p className="text-lg font-medium text-muted-foreground">
            All products
          </p>
        )}
      </div>

      {/* PRODUCT GRID */}
      <div className="mx-auto sm:px-27 w-full max-w-[1540px] px-4 py-10">
        {searchTerm && products.length === 0 ? (
          <div className="w-full py-24 flex flex-col items-center justify-center">
            <p className="text-xl font-semibold">No results found</p>
            <p className="text-sm text-muted-foreground mt-2">
              &quot;{searchTerm}&quot; No results found
            </p>
          </div>
        ) : (
          <div
            className="
          grid 
          grid-cols-1 
          sm:grid-cols-2 
          md:grid-cols-3 
          lg:grid-cols-4 
          gap-6 
          place-items-center
        "
          >
            {products.map((product) => {
              const price = Number(product.raw.variants?.[0]?.price ?? "0");
              const image = product.raw.images?.[0]?.src ?? "/placeholder.png";

              const extractRotaNoFromMetafields = (metafields: any[] = []) => {
                const direct = metafields.find(
                  (m) => m.key === "rota_no"
                )?.value;
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
                        parsed[0].Rota ||
                        parsed[0].rota ||
                        "Unknown"
                      );
                    }
                    if (parsed && typeof parsed === "object") {
                      return (
                        parsed.RotaNo ||
                        parsed.rotaNo ||
                        parsed.Rota ||
                        parsed.rota ||
                        "Unknown"
                      );
                    }
                  } catch (e) {
                    const m = String(candidate.value).match(/\d{3,}/);
                    if (m) return m[0];
                  }
                }

                return "Unknown";
              };

              const code = extractRotaNoFromMetafields(product.raw.metafields);

              const oemsArr =
                product.raw.metafields
                  ?.filter(
                    (m: any) =>
                      /(oem|brand)/i.test(m.key) ||
                      (m.namespace === "custom" && /(oem|brand)/i.test(m.key))
                  )
                  ?.map((m: any) => m.value) ?? [];

              const shopifyId = product.shopifyId ?? (product.raw as any)?.id;

              // determine match type based on active searchTerm
              const matchType = (() => {
                const q = (searchTerm ?? "").toString().trim();
                if (!q) return undefined;
                const lowerQ = q.toLowerCase();
                const codeStr = String(code ?? "").toLowerCase();
                const titleStr = String(product.raw.title ?? "").toLowerCase();

                if (codeStr === lowerQ || titleStr === lowerQ)
                  return "exact" as const;
                if (codeStr.includes(lowerQ) || titleStr.includes(lowerQ))
                  return "partial" as const;
                return undefined;
              })();

              return (
                <SingleProdCard
                  key={product._id}
                  id={code}
                  code={code}
                  title={product.raw.title}
                  shopifyId={shopifyId}
                  price={price}
                  image={image}
                  oems={oemsArr}
                  variantId={`gid://shopify/ProductVariant/${product.raw.variants?.[0]?.id}`}
                  location="CHICAGO"
                  inStock={true}
                  matchType={matchType}
                  searchTerm={searchTerm}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* PAGINATION: hide when there are no products (prevents looping) */}
      {products.length > 0 && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
