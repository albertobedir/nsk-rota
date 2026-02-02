/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import SingleProdCard from "@/components/single-prod-cart";
import { useProductsStore } from "@/store/products-store";
import { Button } from "@/components/ui/button";
import { Search, Share2, X } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BrandModelTypeCombos from "@/components/brand-model-type-combos";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import responseJson from "@/static/response.json";
// TreeFilter removed for step-by-step select flow

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const perPage = 12;

  const { products, total, fetchProducts, searchTerm, searchProducts } =
    useProductsStore();

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

  const [maps, setMaps] = useState<{
    modelsByBrand: Record<string, string[]>;
    typesByBrandModel: Record<string, string[]>;
    descsByBrandModelType: Record<string, string[]>;
  }>({ modelsByBrand: {}, typesByBrandModel: {}, descsByBrandModelType: {} });

  // no modal; use cascading selects: brand -> model -> type

  const buildOptionsFromResponse = (data: any) => {
    // If JSON matches `{ tree: { BRAND: { MODEL: { TYPE: [descs] } } } }` use a specific parser
    if (
      data &&
      typeof data === "object" &&
      data.tree &&
      typeof data.tree === "object"
    ) {
      const tree = data.tree;
      const brands = Object.keys(tree).sort();
      const modelsByBrandPlain: Record<string, string[]> = {};
      const typesByBrandModelPlain: Record<string, string[]> = {};
      const descsByBrandModelTypePlain: Record<string, string[]> = {};

      for (const brand of brands) {
        const modelsObj = tree[brand] || {};
        const models = Object.keys(modelsObj).sort();
        modelsByBrandPlain[brand] = models;

        for (const model of models) {
          const typesObj = modelsObj[model] || {};
          const types = Object.keys(typesObj).sort();
          typesByBrandModelPlain[`${brand}||${model}`] = types;

          for (const type of types) {
            const descs = Array.isArray(typesObj[type])
              ? typesObj[type].map((d: any) => String(d))
              : [];
            descsByBrandModelTypePlain[`${brand}||${model}||${type}`] = descs;
          }
        }
      }

      return {
        options: { brand: brands, model: [], type: [], desc: [], stock: [] },
        maps: {
          modelsByBrand: modelsByBrandPlain,
          typesByBrandModel: typesByBrandModelPlain,
          descsByBrandModelType: descsByBrandModelTypePlain,
        },
      };
    }

    // Fallback generic extraction (flatten strings found anywhere)
    const sets = {
      brand: new Set<string>(),
      model: new Set<string>(),
      type: new Set<string>(),
      desc: new Set<string>(),
      stock: new Set<string>(),
    };

    const visitGeneric = (node: any) => {
      if (node == null) return;
      if (Array.isArray(node)) return node.forEach(visitGeneric);
      if (typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          const lk = k.toLowerCase();
          if (
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
          ) {
            const sv = String(v).trim();
            if (!sv) continue;
            if (lk.includes("brand")) sets.brand.add(sv);
            if (lk.includes("model")) sets.model.add(sv);
            if (lk.includes("type")) sets.type.add(sv);
            if (lk.includes("desc") || lk.includes("description"))
              sets.desc.add(sv);
            if (lk.includes("stock")) sets.stock.add(sv);
          } else {
            visitGeneric(v);
          }
        }
      }
    };

    visitGeneric(data);

    return {
      options: {
        brand: Array.from(sets.brand).sort(),
        model: Array.from(sets.model).sort(),
        type: Array.from(sets.type).sort(),
        desc: Array.from(sets.desc).sort(),
        stock: Array.from(sets.stock).sort(),
      },
      maps: {
        modelsByBrand: {},
        typesByBrandModel: {},
        descsByBrandModelType: {},
      },
    };
  };

  const normalizeOptionArray = (arr: any): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v) => {
        if (v == null) return null;
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (typeof v === "object") {
          return String(
            v.label ??
              v.name ??
              v.title ??
              v.value ??
              v.code ??
              JSON.stringify(v),
          );
        }
        return null;
      })
      .filter(Boolean) as string[];
  };

  const filterFields = [
    {
      key: "brand",
      label: "Brand",
      options: (options.brand.length
        ? options.brand
        : ["HENDRICKSON", "MERCEDES", "SCANIA"]
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: false,
    },
    {
      key: "model",
      label: "Model",
      options: (filters.brand
        ? (maps.modelsByBrand[filters.brand] ?? [])
        : []
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: !filters.brand,
    },
    {
      key: "type",
      label: "Type",
      options: (filters.brand && filters.model
        ? (maps.typesByBrandModel[`${filters.brand}||${filters.model}`] ?? [])
        : []
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: !filters.model,
    },
    {
      key: "desc",
      label: "Description",
      options: (filters.brand && filters.model && filters.type
        ? (maps.descsByBrandModelType[
            `${filters.brand}||${filters.model}||${filters.type}`
          ] ?? [])
        : []
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: !filters.type,
    },
  ];

  const totalPages = Math.ceil(total / perPage);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const requestMsgRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // On mount: fetch dynamic filter options and restore any URL params.
    const fetchOptions = async () => {
      try {
        const res = await fetch("/api/products/options");
        const json = await res.json();
        if (json?.ok && json.options) {
          const src = json.options;
          setOptions({
            brand: normalizeOptionArray(src.brand ?? src.brands ?? []),
            model: normalizeOptionArray(src.model ?? src.models ?? []),
            type: normalizeOptionArray(src.type ?? src.types ?? []),
            desc: normalizeOptionArray(src.desc ?? src.descriptions ?? []),
            stock: normalizeOptionArray(src.stock ?? []),
          });
          // if API returned maps, set them too
          if (json.options.maps) setMaps(json.options.maps as any);
        }
      } catch (e) {
        // fallback — build hierarchical options and maps from local static nested tree
        try {
          const built = buildOptionsFromResponse(responseJson);
          setOptions((prev) => ({ ...prev, brand: built.options.brand }));
          setMaps(built.maps as any);
        } catch (err) {
          // ignore and leave defaults
        }
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
    // fetch the paginated search results instead of the default listing.
    if (searchTerm && searchTerm.trim() !== "") {
      searchProducts(searchTerm, page, perPage);
      return;
    }

    // initial load (no filter-auto-fetch): fetch current page with current filters
    fetchProducts(page, perPage, filters);
    // Only re-run when page or searchTerm changes — filters won't auto-trigger searches
  }, [page, searchTerm, fetchProducts, searchProducts]);

  // Handler to manage cascading selection and clearing children
  const handleSelectChange = (key: string, value: string) => {
    if (key === "brand") {
      // set brand and clear dependent fields (model,type,desc)
      setFilters((prev) => ({
        ...prev,
        brand: value,
        model: "",
        type: "",
        desc: "",
      }));
      return;
    }
    if (key === "model") {
      setFilters((prev) => ({ ...prev, model: value, type: "", desc: "" }));
      return;
    }
    if (key === "type") {
      setFilters((prev) => ({ ...prev, type: value, desc: "" }));
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    const cleared = {
      brand: "",
      model: "",
      type: "",
      desc: "",
      stock: "",
    };
    setFilters(cleared);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    } catch (e) {
      /* ignore */
    }
    // fetch products with cleared filters immediately
    fetchProducts(1, perPage, cleared);
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
      {/* No modal — step-by-step cascading selects below */}

      {/* FILTER SECTION */}
      <div className="mx-auto w-full sm:w-[50%] max-w-[1540px] px-6 mt-20 mb-12 flex flex-col gap-8">
        {/* FILTER SELECTS */}
        <div
          className="flex sm:flex-row flex-col items-center justify-center"
          //   className="
          //   grid grid-cols-1
          //   sm:grid-cols-2
          //   md:grid-cols-3
          //   lg:grid-cols-5
          //   gap-4 w-full
          // "
        >
          <BrandModelTypeCombos
            filters={{
              brand: filters.brand,
              model: filters.model,
              type: filters.type,
              desc: filters.desc,
            }}
            setFilters={setFilters}
          />

          {/* STOCK SWITCH (no card) */}
          <div className="flex sm:ml-5 items-center bg justify-start gap-3">
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
            <h2 className="text-4xl font-bold">Out of stock</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We couldn&apos;t find &quot;{searchTerm}&quot; in our available
              stock.
            </p>

            <div className="mt-6 flex gap-4">
              {/* Desktop: show modal */}
              <div className="hidden md:block">
                <Button
                  className="bg-white text-secondary border"
                  onClick={() => setShowRequestModal(true)}
                >
                  Request product
                </Button>
              </div>

              {/* Mobile: Sheet trigger */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button className="bg-white text-secondary border">
                      Request product
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="max-w-lg">
                    <SheetHeader>
                      <SheetTitle>Request product: {searchTerm}</SheetTitle>
                    </SheetHeader>

                    <div className="p-4">
                      <label className="block font-medium mb-2">Details</label>
                      <Textarea
                        id="product-request-message"
                        defaultValue={`I'm looking for: ${searchTerm}`}
                      />
                    </div>

                    <SheetFooter>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            try {
                              const ta = document.getElementById(
                                "product-request-message",
                              ) as HTMLTextAreaElement | null;
                              const message = ta
                                ? ta.value
                                : `I'm looking for ${searchTerm}`;
                              const resp = await fetch(
                                `/api/requests/product`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    query: searchTerm,
                                    message,
                                  }),
                                },
                              );
                              if (resp.ok) {
                                toast.success("Request submitted");
                                const close = document.querySelector(
                                  '[data-slot="sheet-close"]',
                                ) as HTMLElement | null;
                                if (close) close.click();
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

                        <Button
                          variant="ghost"
                          onClick={() => {
                            const close = document.querySelector(
                              '[data-slot="sheet-close"]',
                            ) as HTMLElement | null;
                            if (close) close.click();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Desktop modal overlay */}
            {showRequestModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setShowRequestModal(false)}
                />

                <div className="bg-white rounded-lg max-w-lg w-full z-10 p-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Request product: {searchTerm}
                  </h3>
                  <label className="block font-medium mb-2">Details</label>
                  <textarea
                    id="product-request-message-desktop"
                    defaultValue={`I'm looking for: ${searchTerm}`}
                    ref={requestMsgRef}
                    className="border-input w-full rounded-md px-3 py-2 mb-4"
                    rows={6}
                  />

                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          const ta = document.getElementById(
                            "product-request-message-desktop",
                          ) as HTMLTextAreaElement | null;
                          const message = ta
                            ? ta.value
                            : `I'm looking for ${searchTerm}`;
                          const resp = await fetch(`/api/requests/product`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              query: searchTerm,
                              message,
                            }),
                          });
                          if (resp.ok) {
                            toast.success("Request submitted");
                            setShowRequestModal(false);
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

                    <Button
                      variant="ghost"
                      onClick={() => setShowRequestModal(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
              const image = product.raw.images?.[0]?.src ?? "";

              const extractRotaNoFromMetafields = (metafields: any[] = []) => {
                const direct = metafields.find(
                  (m) => m.key === "rota_no",
                )?.value;
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
                      (m.namespace === "custom" && /(oem|brand)/i.test(m.key)),
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
                  productRaw={product.raw}
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
