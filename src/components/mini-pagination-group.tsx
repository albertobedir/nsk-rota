"use client";

import React, { useState } from "react";
import SingleProdCard from "@/components/single-prod-cart";

type Prod = {
  id: string;
  code: string;
  title: string;
  price: number;
  image: string;
  oems?: string[];
  location?: string;
  inStock?: boolean;
};

export default function MiniPaginationGroup({
  title,
  items,
  perPage = 4,
}: {
  title: string;
  items?: Prod[];
  perPage?: number;
}) {
  // generate sample items when none provided (dev-friendly)
  const sample = React.useMemo(() => {
    if (items && items.length) return items;
    const arr: Prod[] = [];
    for (let i = 1; i <= 12; i++) {
      arr.push({
        id: `s-${i}`,
        code: `CODE-${i}`,
        title: `Sample Product ${i}`,
        // eslint-disable-next-line react-hooks/purity
        price: Number((Math.random() * 200 + 10).toFixed(3)),
        image: "/placeholder.png",
        oems: [],
        location: i % 2 === 0 ? "Istanbul" : "Ankara",
        inStock: i % 3 !== 0,
      });
    }
    return arr;
  }, [items]);

  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(sample.length / perPage));
  const start = page * perPage;
  const pageItems = sample.slice(start, start + perPage);

  function prev() {
    setPage((p) => Math.max(0, p - 1));
  }
  function next() {
    setPage((p) => Math.min(p + 1, pages - 1));
  }

  return (
    <section className="py-6 w-full">
      <div className="container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>

          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="px-3 py-2 rounded-md bg-white border text-sm text-slate-700 disabled:opacity-40"
              disabled={page === 0}
              aria-label="Previous"
            >
              ‹
            </button>
            <span className="text-sm text-slate-500">
              {page + 1} / {pages}
            </span>
            <button
              onClick={next}
              className="px-3 py-2 rounded-md bg-white border text-sm text-slate-700 disabled:opacity-40"
              disabled={page >= pages - 1}
              aria-label="Next"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pageItems.map((it) => (
            <SingleProdCard
              key={it.id}
              id={it.id}
              code={it.code}
              title={it.title}
              price={it.price}
              image={it.image}
              oems={it.oems}
              location={it.location}
              inStock={it.inStock}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
