import { create } from "zustand";

interface ShopifyImage {
  src: string;
  alt?: string | null;
}

interface ShopifyVariant {
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

  fetchProducts: (
    page: number,
    limit: number,
    filters?: Filters
  ) => Promise<void>;

  searchProducts: (query: string) => Promise<void>;
}

export const useProductsStore = create<ProductState>((set) => ({
  products: [],
  total: 0,

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
    });
  },

  /* ------------------------------- SEARCH ------------------------------- */
  searchProducts: async (query) => {
    if (!query || query.trim() === "") {
      const res = await fetch(`/api/products/gets?page=1&limit=12`, {
        cache: "no-store",
      });

      const json = await res.json();

      set({
        products: json.results ?? [],
        total: json.total ?? 0,
      });

      return;
    }

    const res = await fetch(`/api/products/gets?search=${query}`, {
      cache: "no-store",
    });

    const json = await res.json();

    set({
      products: json.results ?? [],
      total: json.total ?? 0,
    });
  },
}));
