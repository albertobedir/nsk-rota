/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import SingleProdCard from "@/components/single-prod-cart";

export default function CollectionProducts({
  products,
  perPage = 12,
}: {
  products: any[];
  perPage?: number;
}) {
  const [page, setPage] = useState(1);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pageItems = products.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {pageItems.map((product: any) => (
          <SingleProdCard
            key={product._id ?? product.code}
            id={product.code}
            code={product.code}
            title={product.title}
            shopifyId={product.shopifyId}
            productRaw={product.raw}
            price={product.price}
            image={product.image}
            oems={product.oems}
            variantId={`gid://shopify/ProductVariant/${product.raw?.variants?.[0]?.id}`}
            location={product.raw?.location ?? ""}
            inStock={true}
          />
        ))}
      </div>

      {total > 0 && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Prev
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 bg-muted rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
