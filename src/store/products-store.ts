import { create } from "zustand";
export interface IProduct {
  _id: string;
  shopifyId: number;
  raw: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductState {
  products: IProduct[];
  total: number;
  setProducts: (products: IProduct[]) => void;
  setTotal: (total: number) => void;
}

export const useProductsStore = create<ProductState>((set) => ({
  products: [],
  total: 0,

  setProducts: (products) => set({ products }),
  setTotal: (total) => set({ total }),
}));
