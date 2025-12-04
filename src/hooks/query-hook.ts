import { useQuery } from "@tanstack/react-query";
export interface IProduct {
  _id: string;
  shopifyId: number;
  raw: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductsApiResponse {
  ok: boolean;
  total: number;
  page: number;
  limit: number;
  batchSize: number;
  results: IProduct[];
}

export function useProductsSearch(search: string) {
  return useQuery<ProductsApiResponse>({
    queryKey: ["products", search],
    queryFn: async () => {
      if (!search)
        return { results: [], total: 0 } as unknown as ProductsApiResponse;

      const params = new URLSearchParams({
        search,
        page: "1",
        limit: "50",
        batchSize: "100",
      });

      const res = await fetch(`/api/products/gets?${params.toString()}`);
      if (!res.ok) throw new Error("API error");

      return res.json();
    },
    enabled: !!search,
    refetchOnWindowFocus: false,
  });
}
