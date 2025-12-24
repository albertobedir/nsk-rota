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

  const { products, total, fetchProducts } = useProductsStore();

  const [filters, setFilters] = useState({
    brand: "",
    model: "",
    type: "",
    desc: "",
    stock: "",
  });

  const totalPages = Math.ceil(total / perPage);

  useEffect(() => {
    fetchProducts(page, perPage, filters);
  }, [page, filters]);

  const clearFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
  };

  const clearAllFilters = () => {
    setFilters({
      brand: "",
      model: "",
      type: "",
      desc: "",
      stock: "",
    });
  };

  return (
    <div className="w-full">
      {/* PAGE HEADER */}
      <div className="bg-[#f3f3f3] py-16">
        <div className="w-full max-w-[1240px] px-6 mx-auto">
          <h1 className="font-bold text-4xl md:text-5xl text-[#1f1f1f]">
            Product Search
          </h1>

          {/* breadcrumb + badge inside header */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-[#1f1f1f] font-semibold">Home</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f] font-semibold">Products</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f]">Product Search</span>
            </div>
            <Image
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
      <div className="mx-auto w-full max-w-[1240px] px-6 mt-4 mb-12 flex flex-col gap-8">
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
          <div className="flex items-center justify-end gap-3">
            <span className="hidden sm:inline text-[15px] text-[#6f6f6f] font-medium">
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
          <Button className="bg-secondary text-white font-semibold h-[52px] text-[16px] flex gap-2 justify-center">
            Find Product <Search size={18} />
          </Button>

          <Button
            className="bg-secondary text-white font-semibold h-[52px] text-[16px] flex gap-2 justify-center"
            onClick={clearAllFilters}
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

      {/* PRODUCT GRID */}
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
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

            const code =
              product.raw.metafields.find((m) => m.key === "rota_no")?.value ??
              "Unknown";

            return (
              <SingleProdCard
                key={product._id}
                id={code}
                code={code}
                title={product.raw.title}
                price={price}
                image={image}
                oems={[]}
                location="CHICAGO"
                inStock={true}
              />
            );
          })}
        </div>

        {/* PAGINATION */}
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
      </div>
    </div>
  );
}
