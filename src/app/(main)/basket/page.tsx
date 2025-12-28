/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import useSessionStore from "@/store/session-store";
import { toast } from "sonner";
import Hydrate from "@/store/hydrate";

export default function BasketPage() {
  const cart = useSessionStore((s) => s.cart);
  const increase = useSessionStore((s) => s.increase);
  const decrease = useSessionStore((s) => s.decrease);
  const remove = useSessionStore((s) => s.removeFromCart);

  // inputta yazılan geçici değerler
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const clearCartStore = useSessionStore((s) => s.clearCart);

  // Clear entire cart both locally and on server
  const clearAll = async () => {
    try {
      const resp = await fetch("/api/cart/clear", { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || "Failed to clear cart");
      }
      clearCartStore();
      toast.success("Cart cleared");
    } catch (e) {
      console.error("Clear cart failed:", e);
      toast.error("Failed to clear cart");
    }
  };

  const handleGetOffer = () => {
    (async () => {
      try {
        const resp = await fetch("/api/cart/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: cart.map((i) => ({
              merchandiseId: i.variantId,
              quantity: i.quantity,
              originalUnitPrice: i.price,
              title: i.title,
            })),
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          throw new Error(err?.message || "Failed to create draft");
        }

        const json = await resp.json();
        const draft = json?.created?.draftOrder ?? null;
        const invoiceUrl = draft?.invoiceUrl ?? null;

        if (invoiceUrl) {
          // open invoice (Shopify admin/customer invoice) in new tab
          window.open(invoiceUrl, "_blank");
          toast.success("Draft order created");
        } else if (json?.created?.userErrors?.length) {
          toast.error(
            json.created.userErrors[0].message || "Draft created with errors"
          );
        } else {
          toast.success("Draft created");
        }
      } catch (e) {
        console.error("Get offer failed:", e);
        toast.error("Failed to create order draft");
      }
    })();
  };

  // elde yazılan quantity'yi store'a uygular
  // elde yazılan quantity'yi store'a uygular
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setQuantity = async (id: string | number, nextQty: number) => {
    const item = cart.find((x) => x.id === id);
    if (!item) return;

    const normalized = Math.max(1, Math.floor(Number(nextQty) || 1));
    const delta = normalized - item.quantity;

    if (delta > 0) {
      for (let i = 0; i < delta; i++) increase(id as string);
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) decrease(id as string);
    }

    // fire update to server using merchandiseId (variantId)
    try {
      const merch = item.variantId;
      if (!merch) return;

      const resp = await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch, quantity: normalized }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || "Failed to update cart quantity");
      }
    } catch (e) {
      console.error("Set quantity failed:", e);
      toast.error("Failed to sync quantity with server");
    }
  };

  const handleIncrease = async (item: any) => {
    const newQty = (item.quantity ?? 0) + 1;
    increase(item.id);
    try {
      const merch = item.variantId;
      if (!merch) return;
      const resp = await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch, quantity: newQty }),
      });
      if (!resp.ok) throw new Error("Failed to update server");
    } catch (e) {
      console.error("Increase failed:", e);
      toast.error("Failed to sync quantity");
    }
  };

  const handleDecrease = async (item: any) => {
    const newQty = Math.max(1, (item.quantity ?? 1) - 1);
    decrease(item.id);
    try {
      const merch = item.variantId;
      if (!merch) return;
      const resp = await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch, quantity: newQty }),
      });
      if (!resp.ok) throw new Error("Failed to update server");
    } catch (e) {
      console.error("Decrease failed:", e);
      toast.error("Failed to sync quantity");
    }
  };

  const handleRemove = async (item: any) => {
    remove(item.id);
    try {
      const merch = item.variantId;
      if (!merch) return;
      const resp = await fetch("/api/cart/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch }),
      });
      if (!resp.ok) throw new Error("Failed to remove on server");
    } catch (e) {
      console.error("Remove failed:", e);
      toast.error("Failed to remove from server");
    }
  };

  const cartTotalItems = () => cart.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const cartTotalPrice = () =>
    cart.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 0), 0);

  return (
    <Hydrate>
      {/* HEADER */}
      <div className="bg-[#f3f3f3] py-14">
        <div className="mx-auto w-full max-w-[1200px] px-4">
          <h1 className="font-extrabold text-4xl md:text-5xl text-[#2b2b2b]">
            Offer Cart
          </h1>

          <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
            <span>Home</span>
            <span>›</span>
            <span>Products</span>
            <span>›</span>
            <span className="font-semibold text-gray-700">Offer Cart</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="w-full bg-[#fafafa] py-10 px-4 md:px-8 lg:px-40">
        <div className="mx-auto w-full max-w-[1200px] px-4">
          <div className="flex md:flex-row flex-col justify-center gap-4 items-start w-full">
            <div>
              {/* Desktop header row (table head) */}
              <div className="hidden lg:block">
                <div className="bg-white border rounded-xl px-8 py-6 overflow-hidden">
                  <div className="grid grid-cols-[140px_140px_1fr_230px_120px_1px] items-center">
                    <div className="font-bold text-lg text-[#2b2b2b]">
                      Matching Type
                    </div>
                    <div className="font-bold text-lg text-[#2b2b2b]">
                      Searched Value
                    </div>
                    <div className="font-bold text-center text-lg text-[#2b2b2b]">
                      Product Name
                    </div>
                    <div className="font-bold text-lg text-[#2b2b2b]">
                      ROTA No.
                    </div>

                    <button
                      onClick={clearAll}
                      className="justify-self-end flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 text-[#2b2b2b]"
                    >
                      <Trash2 className="shrink-0" />
                      <span className="text-sm font-semibold leading-4 text-left">
                        Clear the <br /> Offer List
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile top actions */}

              {/* Empty */}
              {cart.length === 0 && (
                <div className="mt-10 bg-white border rounded-xl p-10 text-center">
                  <p className="text-2xl font-bold text-gray-500">
                    Your cart is empty.
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="mt-6 wf space-y-5">
                {cart.map((item) => (
                  <div key={item.id}>
                    {/* Desktop row */}
                    <div className="hidden lg:block">
                      <div className="bg-white border rounded-xl px-8 py-6 overflow-hidden">
                        <div className="grid grid-cols-[140px_140px_1fr_120px_120px_80px] items-center gap-4">
                          {/* Matching Type */}
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                              ✓
                            </span>
                            <span className="font-semibold">Exact Match</span>
                          </div>

                          {/* Searched Value */}
                          <div className="text-gray-500">
                            {item.subtitle ?? '""'}
                          </div>

                          {/* Product */}
                          <div className="flex items-center gap-4">
                            <div className="relative h-16 w-16 rounded-lg border bg-white overflow-hidden">
                              <Image
                                src={item.image}
                                alt={item.title}
                                fill
                                className="object-contain p-2"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-lg text-[#2b2b2b] truncate">
                                {item.title}
                              </p>
                              <p className="text-gray-500 text-sm truncate">
                                {item.subtitle ?? ""}
                              </p>

                              <div className="mt-1 text-sm text-gray-700 flex items-center gap-4">
                                <span className="text-gray-500">Quantity:</span>
                                <span className="font-semibold">
                                  {(item.price ?? 0).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  })}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-500">Total:</span>
                                <span className="font-semibold">
                                  {(
                                    (item.price ?? 0) * (item.quantity ?? 0)
                                  ).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ROTA No */}
                          <div className="font-extrabold text-lg text-[#2b2b2b]">
                            {String(item.id).slice(0, 8)}
                          </div>

                          {/* Qty (INPUT) */}
                          <div className="justify-self-center flex items-center gap-4 text-gray-400">
                            <button
                              className="text-xl leading-none hover:text-gray-700"
                              onClick={() => handleDecrease(item)}
                            >
                              –
                            </button>

                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              className="w-14 text-center text-base font-bold text-gray-600 bg-transparent border-b border-transparent focus:border-gray-300 outline-none"
                              value={
                                qtyDraft[String(item.id)] ??
                                String(item.quantity)
                              }
                              onChange={(e) => {
                                setQtyDraft((p) => ({
                                  ...p,
                                  [String(item.id)]: e.target.value,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                              onBlur={() => {
                                const key = String(item.id);
                                const raw = qtyDraft[key];
                                if (raw === undefined) return;

                                const parsed = Number(raw);
                                setQuantity(item.id, parsed);

                                setQtyDraft((p) => {
                                  const c = { ...p };
                                  delete c[key];
                                  return c;
                                });
                              }}
                            />

                            <button
                              className="text-xl leading-none hover:text-gray-700"
                              onClick={() => handleIncrease(item)}
                            >
                              +
                            </button>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleRemove(item)}
                            className="justify-self-end text-gray-400 hover:text-red-600"
                            aria-label="Remove item"
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden w-[20.4rem] bg-white border rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#1f3b7b]">
                            Eşleşme Türü:
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-gray-600">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                              ✓
                            </span>
                            <span className="font-semibold">Exact Match</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[#1f3b7b]">
                            Aranan Değer:
                          </p>
                          <p className="mt-1 text-gray-500">
                            {item.subtitle ?? '""'}
                          </p>
                        </div>
                      </div>

                      <div className="my-4 border-t" />

                      <p className="text-sm font-bold text-[#1f3b7b]">
                        Ürün Adı:
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="relative h-16 w-16 rounded-lg border bg-white overflow-hidden shrink-0">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-contain p-2"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-base text-[#2b2b2b] truncate">
                            {item.title}
                          </p>
                          <p className="text-gray-500 text-sm truncate">
                            {item.subtitle ?? ""}
                          </p>

                          <div className="mt-1 text-sm text-gray-700 flex flex-col sm:flex-row items-start gap-0 sm:gap-3">
                            <div>
                              <span className="text-gray-500">Quantity:</span>
                              <span className="font-semibold">
                                {(item.price ?? 0).toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="font-semibold">
                                {(item.price ?? 0).toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-bold text-[#1f3b7b]">
                          Rota No:
                        </p>
                        <p className="mt-1 font-extrabold text-lg text-[#2b2b2b]">
                          {String(item.id).slice(0, 8)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        {/* Qty (INPUT) */}
                        <div className="flex items-center gap-5 rounded-lg bg-gray-100 px-4 py-2 text-gray-500">
                          <button
                            className="text-xl leading-none hover:text-gray-700"
                            onClick={() => handleDecrease(item)}
                          >
                            –
                          </button>

                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="w-14 text-center text-base font-bold text-gray-600 bg-transparent outline-none"
                            value={
                              qtyDraft[String(item.id)] ?? String(item.quantity)
                            }
                            onChange={(e) => {
                              setQtyDraft((p) => ({
                                ...p,
                                [String(item.id)]: e.target.value,
                              }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                (e.target as HTMLInputElement).blur();
                            }}
                            onBlur={() => {
                              const key = String(item.id);
                              const raw = qtyDraft[key];
                              if (raw === undefined) return;

                              const parsed = Number(raw);
                              setQuantity(item.id, parsed);

                              setQtyDraft((p) => {
                                const c = { ...p };
                                delete c[key];
                                return c;
                              });
                            }}
                          />

                          <button
                            className="text-xl leading-none hover:text-gray-700"
                            onClick={() => handleIncrease(item)}
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemove(item)}
                          className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-600"
                          aria-label="Remove item"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom centered button */}
            </div>

            {/* Summary panel */}
            <aside className="w-full lg:w-auto lg:max-w-xs order-last lg:order-0">
              <div className="bg-white border rounded-xl p-5 lg:sticky lg:top-28">
                <h3 className="font-bold text-lg">Cart Summary</h3>
                <div className="mt-4 text-sm text-gray-600 flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">
                    {cartTotalPrice().toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
                  <span>Shipping</span>
                  <span className="text-sm text-green-600 font-semibold">
                    Free
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex gap-2">
                    <input
                      placeholder="Discount code"
                      className="flex-1 rounded-md border px-3 py-2 text-sm"
                    />
                    <button className="rounded-md bg-gray-100 px-3 py-2 text-sm">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Total ({cartTotalItems()} items)
                    </div>
                    <div className="font-extrabold text-xl">
                      {cartTotalPrice().toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleGetOffer}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-3 font-extrabold text-white text-base hover:bg-[#e58f0a]"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Hydrate>
  );
}
