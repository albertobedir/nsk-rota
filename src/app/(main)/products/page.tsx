/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import SingleProdCard from "@/components/single-prod-cart";
import { useProductsStore } from "@/store/products-store";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Search, Share2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  const perPage = 16;

  const {
    products,
    total,
    fetchProducts,
    searchTerm,
    searchProducts,
    isLoading,
  } = useProductsStore();

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
    typesByBrand: Record<string, string[]>;
    descsByBrand: Record<string, string[]>;
  }>({
    modelsByBrand: {},
    typesByBrandModel: {},
    descsByBrandModelType: {},
    typesByBrand: {},
    descsByBrand: {},
  });

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

      const typesByBrandPlain: Record<string, string[]> = {};
      const descsByBrandPlain: Record<string, string[]> = {};

      for (const brand of brands) {
        const modelsObj = tree[brand] || {};
        const models = Object.keys(modelsObj).sort();
        modelsByBrandPlain[brand] = models;

        const brandTypesSet = new Set<string>();
        const brandDescSet = new Set<string>();

        for (const model of models) {
          const typesObj = modelsObj[model] || {};
          const types = Object.keys(typesObj).sort();
          typesByBrandModelPlain[`${brand}||${model}`] = types;

          for (const type of types) {
            brandTypesSet.add(type);
            const descs = Array.isArray(typesObj[type])
              ? typesObj[type].map((d: any) => String(d))
              : [];
            descs.forEach((d: string) => brandDescSet.add(d));
            descsByBrandModelTypePlain[`${brand}||${model}||${type}`] = descs;
          }
        }

        typesByBrandPlain[brand] = Array.from(brandTypesSet).sort();
        descsByBrandPlain[brand] = Array.from(brandDescSet).sort();
      }

      return {
        options: { brand: brands, model: [], type: [], desc: [], stock: [] },
        maps: {
          modelsByBrand: modelsByBrandPlain,
          typesByBrandModel: typesByBrandModelPlain,
          descsByBrandModelType: descsByBrandModelTypePlain,
          typesByBrand: typesByBrandPlain,
          descsByBrand: descsByBrandPlain,
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
        typesByBrand: {},
        descsByBrand: {},
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
      options: (filters.brand
        ? filters.model
          ? (maps.typesByBrandModel[`${filters.brand}||${filters.model}`] ?? [])
          : (maps.typesByBrand[filters.brand] ?? [])
        : []
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: !filters.brand,
    },
    {
      key: "desc",
      label: "Description",
      options: (filters.brand
        ? filters.brand && filters.model && filters.type
          ? (maps.descsByBrandModelType[
              `${filters.brand}||${filters.model}||${filters.type}`
            ] ?? [])
          : (maps.descsByBrand[filters.brand] ?? [])
        : []
      ).map((o) => (typeof o === "string" ? o : JSON.stringify(o))),
      disabled: !filters.brand,
    },
  ];

  const totalPages = Math.ceil(total / perPage);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTerm, setRequestTerm] = useState("");
  const requestMsgRef = useRef<HTMLTextAreaElement | null>(null);

  const REQUESTED_PRODUCTS_KEY = "requested_products";
  const [requestedTerms, setRequestedTerms] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const list: string[] = JSON.parse(
        localStorage.getItem(REQUESTED_PRODUCTS_KEY) ?? "[]",
      );
      setRequestedTerms(new Set(list.map((s) => s.toLowerCase())));
    } catch {}
  }, []);

  useEffect(() => {
    // On mount: fetch dynamic filter options and restore any URL params.
    // Returns an object with restored filters/page when available so caller
    // can use them immediately for the first products fetch.
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
        if (Object.keys(restore).length) {
          setFilters((prev) => ({ ...prev, ...restore }));
          if (p) setPage(Number(p));
          return { filters: { ...restore }, page: p ? Number(p) : undefined };
        }

        // If no URL params, try restoring from localStorage
        try {
          const saved = localStorage.getItem("products_filters");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.filters)
              setFilters((prev) => ({ ...prev, ...parsed.filters }));
            if (parsed?.page) setPage(Number(parsed.page) || 1);
            return {
              filters: parsed.filters ?? undefined,
              page: parsed.page ?? undefined,
            };
          }
        } catch (e) {
          /* ignore */
        }
        return {};
      } catch (e) {
        /* ignore */
      }
    };

    (async () => {
      const restored = await fetchOptions();

      // If there's an active searchTerm (coming from another page),
      // fetch the paginated search results instead of the default listing.
      if (searchTerm && searchTerm.trim() !== "") {
        searchProducts(searchTerm, restored?.page ?? page, perPage);
        return;
      }

      // Use restored filters/page when available to fetch the correct listing
      const useFilters = restored?.filters ?? filters;
      const usePage = restored?.page ?? page;
      fetchProducts(usePage, perPage, useFilters);
    })();

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
      localStorage.removeItem("products_filters");
    } catch (e) {
      /* ignore */
    }
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

  const handlePageChange = (newPage: number) => {
    setPage(newPage);

    // keep URL params in sync
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("page", String(newPage));
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
    } catch (e) {
      /* ignore */
    }

    // keep localStorage in sync
    try {
      const saved = localStorage.getItem("products_filters");
      const parsed = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        "products_filters",
        JSON.stringify({ ...parsed, page: newPage }),
      );
    } catch (e) {
      /* ignore */
    }
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

    // persist current filters/page so returning to this page restores them
    try {
      localStorage.setItem(
        "products_filters",
        JSON.stringify({ filters, page: pageNum }),
      );
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
              className="data-[state=checked]:bg-green-600"
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
      <div className="flex justify-center items-start w-full">
        {searchTerm ? null : Object.values(filters).some((f) => f) ? (
          (() => {
            const activeFilters = [
              { label: "Brand", value: filters.brand },
              { label: "Model", value: filters.model },
              { label: "Type", value: filters.type },
              { label: "Description", value: filters.desc },
              { label: "In Stock Only", value: filters.stock },
            ].filter((f) => f.value);

            return (
              <p className="text-lg font-medium">
                {activeFilters.map((filter, idx) => (
                  <span key={filter.label}>
                    <span className="opacity-60">{filter.label}:</span>{" "}
                    <span className="text-secondary font-semibold">
                      {filter.value}
                    </span>
                    {idx < activeFilters.length - 1 && (
                      <span className="opacity-60"> • </span>
                    )}
                  </span>
                ))}
              </p>
            );
          })()
        ) : (
          <p className="text-lg font-medium text-muted-foreground">
            All products
          </p>
        )}
      </div>

      {/* PRODUCT GRID */}
      <div className="mx-auto sm:px-27 w-full max-w-[1540px] px-4 py-10">
        {isLoading ? (
          <div className="w-full py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (searchTerm || Object.values(filters).some((f) => f)) &&
          products.length === 0 ? (
          <div className="w-full">
            {/* Section header */}
            <div className="text-center mb-8">
              {searchTerm ? (
                <>
                  <h2 className="text-3xl font-bold text-[#1f1f1f]">
                    Not found in stock
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    The following item(s) are not currently available. Request
                    them below.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-bold text-[#1f1f1f]">
                    No products found
                  </h2>
                  <p className="text-base text-muted-foreground mt-4">
                    No products match your selected filters. Try adjusting your
                    search criteria.
                  </p>
                </>
              )}
            </div>

            {/* One card per search term — same grid as product listing */}
            {searchTerm && (
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
                {String(searchTerm)
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((term) => (
                    <Card
                      key={term}
                      className="shadow-none bg-white flex flex-col gap-0 rounded-md w-full p-0 border-2 h-full"
                    >
                      {/* Placeholder image area */}
                      <div className="relative w-full rounded-t-[inherit] h-36 md:h-56 lg:h-64 bg-muted/30 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon size={48} strokeWidth={1.2} />
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="flex flex-col bg-white gap-3 p-4 flex-1">
                        {/* Code / term */}
                        <p className="font-extrabold text-2xl md:text-3xl leading-none text-[#1f1f1f] break-all">
                          {term}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Not available in current stock
                        </p>

                        {/* Get Request button — desktop opens modal, mobile opens sheet */}
                        <div className="mt-auto pt-3">
                          {/* Desktop */}
                          <div className="hidden md:block">
                            <Button
                              disabled={requestedTerms.has(term.toLowerCase())}
                              className={`w-full font-semibold ${
                                requestedTerms.has(term.toLowerCase())
                                  ? "bg-gray-400 text-white cursor-not-allowed"
                                  : "bg-secondary text-white"
                              }`}
                              onClick={() => {
                                if (requestedTerms.has(term.toLowerCase()))
                                  return;
                                setRequestTerm(term);
                                setShowRequestModal(true);
                              }}
                            >
                              {requestedTerms.has(term.toLowerCase())
                                ? "Already Requested"
                                : "Get Request"}
                            </Button>
                          </div>

                          {/* Mobile */}
                          <div className="md:hidden">
                            <Sheet>
                              <SheetTrigger asChild>
                                <Button
                                  disabled={requestedTerms.has(
                                    term.toLowerCase(),
                                  )}
                                  className={`w-full font-semibold ${
                                    requestedTerms.has(term.toLowerCase())
                                      ? "bg-gray-400 text-white cursor-not-allowed"
                                      : "bg-secondary text-white"
                                  }`}
                                  onClick={() =>
                                    !requestedTerms.has(term.toLowerCase()) &&
                                    setRequestTerm(term)
                                  }
                                >
                                  {requestedTerms.has(term.toLowerCase())
                                    ? "Already Requested"
                                    : "Get Request"}
                                </Button>
                              </SheetTrigger>
                              <SheetContent side="right" className="max-w-lg">
                                <SheetHeader>
                                  <SheetTitle>
                                    Request product: {term}
                                  </SheetTitle>
                                </SheetHeader>
                                <div className="p-4">
                                  <label className="block font-medium mb-2">
                                    Details
                                  </label>
                                  <Textarea
                                    id={`product-request-message-${term}`}
                                    defaultValue={`I'm looking for: ${term}`}
                                  />
                                </div>
                                <SheetFooter>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        try {
                                          const ta = document.getElementById(
                                            `product-request-message-${term}`,
                                          ) as HTMLTextAreaElement | null;
                                          const message = ta
                                            ? ta.value
                                            : `I'm looking for ${term}`;
                                          const resp = await fetch(
                                            `/api/requests/product`,
                                            {
                                              method: "POST",
                                              headers: {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                              body: JSON.stringify({
                                                query: term,
                                                message,
                                              }),
                                            },
                                          );
                                          if (resp.ok) {
                                            try {
                                              const list: string[] = JSON.parse(
                                                localStorage.getItem(
                                                  REQUESTED_PRODUCTS_KEY,
                                                ) ?? "[]",
                                              );
                                              if (
                                                !list
                                                  .map((s) => s.toLowerCase())
                                                  .includes(term.toLowerCase())
                                              ) {
                                                list.push(term);
                                                localStorage.setItem(
                                                  REQUESTED_PRODUCTS_KEY,
                                                  JSON.stringify(list),
                                                );
                                              }
                                              setRequestedTerms(
                                                (prev) =>
                                                  new Set([
                                                    ...prev,
                                                    term.toLowerCase(),
                                                  ]),
                                              );
                                            } catch {}
                                            toast.success("Request submitted");
                                            const close =
                                              document.querySelector(
                                                '[data-slot="sheet-close"]',
                                              ) as HTMLElement | null;
                                            if (close) close.click();
                                          } else {
                                            toast.error(
                                              "Failed to submit request",
                                            );
                                          }
                                        } catch (e) {
                                          console.error(e);
                                          toast.error(
                                            "Failed to submit request",
                                          );
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
                      </div>
                    </Card>
                  ))}
              </div>
            )}

            {/* Desktop modal overlay */}
            {showRequestModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setShowRequestModal(false)}
                />
                <div className="bg-white rounded-lg max-w-lg w-full z-10 p-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Request product: {requestTerm}
                  </h3>
                  <label className="block font-medium mb-2">Details</label>
                  <textarea
                    key={requestTerm}
                    id="product-request-message-desktop"
                    defaultValue={`I'm looking for: ${requestTerm}`}
                    ref={requestMsgRef}
                    className="border-input w-full rounded-md px-3 py-2 mb-4"
                    rows={6}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          const message = requestMsgRef.current
                            ? requestMsgRef.current.value
                            : `I'm looking for ${requestTerm}`;
                          const resp = await fetch(`/api/requests/product`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              query: requestTerm,
                              message,
                            }),
                          });
                          if (resp.ok) {
                            try {
                              const list: string[] = JSON.parse(
                                localStorage.getItem(REQUESTED_PRODUCTS_KEY) ??
                                  "[]",
                              );
                              if (
                                !list
                                  .map((s) => s.toLowerCase())
                                  .includes(requestTerm.toLowerCase())
                              ) {
                                list.push(requestTerm);
                                localStorage.setItem(
                                  REQUESTED_PRODUCTS_KEY,
                                  JSON.stringify(list),
                                );
                              }
                              setRequestedTerms(
                                (prev) =>
                                  new Set([...prev, requestTerm.toLowerCase()]),
                              );
                            } catch {}
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
          xl:grid-cols-4 
          gap-6 
          place-items-center
        "
          >
            {products.map((product) => {
              const price = Number(product.raw.variants?.[0]?.price ?? "0");
              // Fallback image selection: try images array, then placeholder
              const image =
                product.raw.images?.[0]?.src ||
                product.raw.images?.[1]?.src ||
                "/image_not_found.png";

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

              // Only pick the oem_info metafield (which holds ALL OEMs as a
              // JSON array), parse it and spread into individual objects so
              // every entry gets its own brand + OEM number in the card.
              const oemsArr = (() => {
                const oemMeta = product.raw.metafields?.find(
                  (m: any) => m.namespace === "custom" && m.key === "oem_info",
                );
                if (!oemMeta?.value) return [];
                try {
                  const parsed = JSON.parse(oemMeta.value);
                  return Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  return [oemMeta.value];
                }
              })();

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

              const originalPrice = (product as any)?.originalPrice
                ? Number((product as any).originalPrice)
                : price;

              return (
                <SingleProdCard
                  key={product._id}
                  id={code}
                  code={code}
                  title={product.raw.title}
                  shopifyId={shopifyId}
                  productRaw={product.raw}
                  price={price}
                  originalPrice={originalPrice}
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
            onClick={() => handlePageChange(page - 1)}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => handlePageChange(page + 1)}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
