/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

interface ShopifyImage {
  src: string;
  alt?: string | null;
}

interface ShopifyVariant {
  inventory_quantity: any;
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
}

export interface IProduct {
  _id: string;
  shopifyId: number;
  raw: ShopifyRaw;
  createdAt?: string;
  updatedAt?: string;
}

export interface Filters {
  brand?: string;
  model?: string;
  type?: string;
  desc?: string; // frontend name
  stock?: string; // frontend name
}

interface ProductState {
  products: IProduct[];
  total: number;
  searchTerm: string;

  fetchProducts: (
    page: number,
    limit: number,
    filters?: Filters
  ) => Promise<void>;
  searchProducts: (
    query: string,
    page?: number,
    limit?: number
  ) => Promise<void>;
}

export const useProductsStore = create<ProductState>((set) => ({
  products: [],
  total: 0,
  searchTerm: "",

  /* -------------------------------------------------------
      UPDATED fetchProducts → frontend filters → API filters
  -------------------------------------------------------- */
  fetchProducts: async (page, limit, filters = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),

      ...(filters.brand && { brand: filters.brand }),
      ...(filters.model && { model: filters.model }),
      ...(filters.type && { type: filters.type }),

      // FIXED: backend expects `description`, NOT desc
      ...(filters.desc && { description: filters.desc }),

      // FIXED: backend expects `instock`, NOT stock
      ...(filters.stock && { instock: filters.stock }),
    });

    const res = await fetch(`/api/products/gets?${query.toString()}`, {
      cache: "no-store",
    });

    const json = await res.json();

    console.log("API → fetchProducts response:", json); // debug için

    set({
      products: json.results ?? [],
      total: json.total ?? 0,
      searchTerm: "",
    });
  },

  /* ------------------------------- SEARCH ------------------------------- */
  searchProducts: async (query, page = 1, limit = 12) => {
    // empty query: fallback to paged regular listing
    if (!query || query.trim() === "") {
      const res = await fetch(
        `/api/products/gets?page=${page}&limit=${limit}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      set({
        products: json.results ?? [],
        total: json.total ?? 0,
        searchTerm: "",
      });

      return;
    }

    // include pagination params for search requests so backend can return paged results
    const qs = new URLSearchParams({
      search: String(query),
      page: String(page),
      limit: String(limit),
    });

    const res = await fetch(`/api/products/gets?${qs.toString()}`, {
      cache: "no-store",
    });

    const json = await res.json();

    set({
      products: json.results ?? [],
      total: json.total ?? 0,
      searchTerm: query,
    });
  },
}));
