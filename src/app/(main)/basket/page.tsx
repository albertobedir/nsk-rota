/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const sessionUser = useSessionStore((s) => s.user);
  const pricingTiers = useSessionStore((s) => s.pricingTiers);
  const router = useRouter();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Discount states
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  // map of itemId -> available stock (number)
  const [stockMap, setStockMap] = useState<Record<string, number | undefined>>(
    {},
  );

  // Clear entire cart both locally and on server
  const clearAll = async () => {
    try {
      const resp = await fetch("/api/cart/clear", { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || "Failed to clear cart");
      }
      clearCartStore();
      setShowClearConfirm(false);
      toast.success("Cart cleared");
    } catch (e) {
      console.error("Clear cart failed:", e);
      toast.error("Failed to clear cart");
    }
  };

  // Handle discount code validation
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    try {
      const resp = await fetch("/api/cart/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode.trim(),
          lineItems: cart.map((i) => ({
            variantId: i.variantId?.toString().includes("/")
              ? i.variantId.toString().split("/").pop()
              : i.variantId,
            quantity: i.quantity,
            price: String(i.price),
            title: i.title,
          })),
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.valid) {
        toast.error(json.message || "Invalid discount code");
        return;
      }
      setDiscountApplied({ code: json.code, amount: json.amount });
      toast.success(
        `Discount applied: -${json.amount.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })}`,
      );
    } catch {
      toast.error("Failed to apply discount");
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleGetOffer = () => {
    (async () => {
      try {
        // Calculate discount percentage from pricing tiers
        let discountPercentage = 0;
        if (sessionUser?.tier && pricingTiers && pricingTiers.length > 0) {
          const matchingTier = pricingTiers.find(
            (t) => (t as any).fieldsMap?.tier_tag === sessionUser.tier,
          );
          if (matchingTier) {
            const discountStr = (matchingTier as any).fieldsMap
              ?.discount_percentage;
            discountPercentage = parseFloat(discountStr) || 0;
          }
        }

        const resp = await fetch("/api/cart/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerEmail: sessionUser?.email,
            customerId: sessionUser?.id,
            userTier: sessionUser?.tier,
            discountPercentage,
            discountCode: discountApplied?.code ?? null,
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
          throw new Error(err?.message || "Failed to create order");
        }

        const json = await resp.json();
        const order = json?.order;
        const invoiceUrl = json?.created?.draftOrder?.invoiceUrl;

        if (order) {
          toast.success(`Order ${order.name} created!`);
          // Yönlendirme yapabilirsiniz:
          // window.location.href = "/invoices";
          // veya invoice URL'i açabilirsiniz:
          if (invoiceUrl) {
            window.open(invoiceUrl, "_blank");
          }
        } else {
          toast.success("Draft created");
          if (invoiceUrl) {
            window.open(invoiceUrl, "_blank");
          }
          await fetch("/api/cart/clear", { method: "POST" }).catch(() => null);
          clearCartStore();
          router.push("/profile/order-history");
        }
      } catch (e) {
        console.error("Request offer failed:", e);
        toast.error("Failed to create order");
      }
    })();
  };

  // elde yazılan quantity'yi store'a uygular
  // elde yazılan quantity'yi store'a uygular
  const setQuantity = async (id: string | number, nextQty: number) => {
    const item = cart.find((x) => x.id === id);
    if (!item) return;
    const requested = Math.max(1, Math.floor(Number(nextQty) || 1));
    // cap to available stock if known
    const avail = stockMap[String(id)];
    const normalized =
      avail !== undefined ? Math.min(requested, avail) : requested;
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
    const avail = stockMap[String(item.id)];
    if (avail !== undefined && newQty > avail) {
      toast.error("Cannot add more than available stock");
      return;
    }
    increase(item.id);
    try {
      const merch = item.variantId;
      if (!merch) return;
      await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch, quantity: newQty }),
      });
      // if (!resp.ok) throw new Error("Failed to update server");
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
      await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchandiseId: merch, quantity: newQty }),
      });
      // if (!resp.ok) throw new Error("Failed to update server");
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

  // Keep stockMap updated for items in cart
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const entries = await Promise.all(
          cart.map(async (item) => {
            try {
              const v = item.variantId ?? "";
              // extract numeric id if gid
              const vid = String(v).includes("/")
                ? String(v).split("/").pop()
                : String(v);
              if (!vid) return [String(item.id), undefined] as const;
              const resp = await fetch(
                `/api/products/gets?variantId=${encodeURIComponent(vid)}`,
              );
              const json = await resp.json().catch(() => null);
              const found = json?.results?.[0] ?? null;
              if (!found) return [String(item.id), undefined] as const;
              const firstVariant =
                (found.raw?.variants && found.raw.variants[0]) ?? null;
              // prefer inventory_locations[1] then [0]
              let avail: number | undefined = undefined;
              try {
                const invs = firstVariant?.inventory_locations;
                if (Array.isArray(invs) && invs.length > 0) {
                  const preferred = invs[1] ?? invs[0];
                  const q = Number(
                    preferred?.available ?? preferred?.quantity ?? 0,
                  );
                  if (!Number.isNaN(q)) avail = q;
                }
              } catch {
                // ignore
              }
              if (avail === undefined) {
                const q = Number(firstVariant?.inventory_quantity ?? 0);
                if (!Number.isNaN(q)) avail = q;
              }

              return [String(item.id), avail] as const;
            } catch {
              return [String(item.id), undefined] as const;
            }
          }),
        );

        if (!mounted) return;
        const map: Record<string, number | undefined> = {};
        for (const [k, v] of entries) map[k] = v;
        setStockMap(map);
      } catch (e) {
        console.warn("Failed to fetch stock map", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [cart]);

  const cartTotalItems = () => cart.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const cartTotalPrice = () =>
    cart.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 0), 0);

  const finalTotal = () => {
    const base = cartTotalPrice();
    return discountApplied ? Math.max(0, base - discountApplied.amount) : base;
  };

  return (
    <Hydrate>
      {/* HEADER */}
      <div className="bg-[#f3f3f3] py-14">
        <div className="bg-[#f3f3f3] py-10">
          <div className="w-full max-w-[1540px]  px-6 md:px-27 mx-auto">
            <h1 className="font-bold text-center sm:text-start text-4xl md:text-5xl text-[#1f1f1f]">
              Offer Cart
            </h1>

            {/* breadcrumb + badge inside header */}
            <div className=" flex flex-col md:flex-row gap-2 items-center justify-between">
              <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                <span>Home</span>
                <span>›</span>
                <span>Products</span>
                <span>›</span>
                <span className="font-semibold text-gray-700">Offer Cart</span>
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
      </div>

      {/* CONTENT */}
      <div className="w-full bg-[#fafafa] py-10 px-4 md:px-8 lg:px-40 ">
        <div className="mx-auto sm:px-27 w-full max-w-[1200px] px-4">
          {/* Confirm Clear Modal */}
          {showClearConfirm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowClearConfirm(false)}
              />
              <div className="relative bg-white rounded-lg shadow-lg w-[90%] max-w-md p-6 z-10">
                <h3 className="text-lg font-bold mb-2">Confirm clear</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to clear the offer list? This will
                  remove all items from your cart.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => clearAll()}
                    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Yes, clear
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex md:flex-row flex-col justify-center gap-4 items-start w-full">
            <div>
              {/* Desktop header row (table head) */}
              <div className="hidden lg:block">
                <div className="bg-white border rounded-xl px-8 py-6 overflow-hidden">
                  <div className="grid grid-cols-[140px_1fr_230px_120px_80px] items-center gap-4">
                    <div className="font-bold text-lg text-[#2b2b2b]">
                      Matching Type
                    </div>
                    <div className="font-bold text-lg text-[#2b2b2b] pl-3">
                      Product Name
                    </div>
                    <div className="font-bold text-lg text-[#2b2b2b]">
                      ROTA No.
                    </div>
                    <div className="font-bold text-center text-lg text-[#2b2b2b]">
                      Qty
                    </div>

                    <button
                      onClick={() => setShowClearConfirm(true)}
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
                <div className="mt-10 w-[1200px] bg-white border rounded-xl p-10 text-center">
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
                    <div className="hidden lg:block w-[1200px]">
                      <div className="bg-white  border rounded-xl px-8 py-6 overflow-hidden">
                        <div className="grid grid-cols-[140px_1fr_230px_120px_80px] items-center gap-4">
                          {/* Matching Type */}
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                              ✓
                            </span>
                            <span className="font-semibold">Exact Match</span>
                          </div>

                          {/* Product (clickable) */}
                          <Link
                            href={`/products/${item.id}`}
                            className="flex items-center gap-4 cursor-pointer pl-3"
                          >
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
                                {(item.title ?? "")
                                  .replace(/\s*-\s*[\w\d]+$/, "")
                                  .trim() || item.title}
                              </p>
                              <p className="text-gray-500 text-sm truncate">
                                {item.subtitle ?? ""}
                              </p>

                              <div className="mt-1 text-sm text-gray-700 flex items-center gap-4">
                                <span className="font-semibold">
                                  {(
                                    (item.price ?? 0) * (item.quantity ?? 0)
                                  ).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  })}{" "}
                                  (
                                  <span className="font-normal">
                                    {item.quantity ?? 0} x{" "}
                                    {Number(item.price ?? 0).toLocaleString(
                                      "en-US",
                                      {
                                        style: "currency",
                                        currency: "USD",
                                      },
                                    )}
                                  </span>
                                  )
                                </span>
                              </div>
                            </div>
                          </Link>

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

                      <div className="my-4 border-t" />

                      <p className="text-sm font-bold text-[#1f3b7b]">
                        Ürün Adı:
                      </p>
                      <Link
                        href={`/products/${item.id}`}
                        className="mt-2 flex items-center gap-3 cursor-pointer"
                      >
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
                            {(item.title ?? "")
                              .replace(/\s*-\s*[\w\d]+$/, "")
                              .trim() || item.title}
                          </p>
                          <p className="text-gray-500 text-sm truncate">
                            {item.subtitle ?? ""}
                          </p>

                          <div className="mt-1 text-sm text-gray-700">
                            <span className="font-semibold">
                              total(
                              {(
                                (item.price ?? 0) * (item.quantity ?? 0)
                              ).toLocaleString("en-US", {
                                style: "currency",
                                currency: "USD",
                              })}
                              ) (
                              <span className="font-normal">
                                {item.quantity ?? 0} x{" "}
                                {Number(item.price ?? 0).toLocaleString(
                                  "en-US",
                                  {
                                    style: "currency",
                                    currency: "USD",
                                  },
                                )}
                              </span>
                              )
                            </span>
                          </div>
                        </div>
                      </Link>

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
                <h3 className="font-bold text-lg translate-y-5">
                  Cart Summary
                </h3>
                <div className="mt-4 text-sm text-gray-600 translate-y-5 flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">
                    {cartTotalPrice().toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </span>
                </div>

                <div className="mt-4">
                  {discountApplied ? (
                    <div className="flex items-center justify-between text-sm bg-green-50 rounded-md px-3 py-2">
                      <span className="text-green-700 font-semibold">
                        🎟 {discountApplied.code}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 font-semibold">
                          -{discountApplied.amount.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })}
                        </span>
                        <button
                          onClick={() => {
                            setDiscountApplied(null);
                            setDiscountCode("");
                          }}
                          className="text-gray-400 hover:text-red-500 text-xs ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyDiscount();
                        }}
                        placeholder="Discount code"
                        className="flex-1 rounded-md border px-3 py-2 text-sm"
                      />
                      <button
                        onClick={handleApplyDiscount}
                        disabled={discountLoading || cart.length === 0}
                        className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 disabled:opacity-50"
                      >
                        {discountLoading ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                {discountApplied && (
                  <div className="mt-2 text-sm text-green-600 translate-y-5 flex items-center justify-between">
                    <span>Discount ({discountApplied.code})</span>
                    <span className="font-semibold">
                      -{discountApplied.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </span>
                  </div>
                )}

                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Total ({cartTotalItems()} items)
                    </div>
                    <div className="font-extrabold text-xl">
                      {finalTotal().toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </div>
                  </div>

                  {(() => {
                    const remaining = Number(
                      sessionUser?.creditRemaining ?? Number.POSITIVE_INFINITY,
                    );
                    const disabledByCredit = finalTotal() > remaining;

                    return (
                      <button
                        onClick={handleGetOffer}
                        disabled={disabledByCredit}
                        className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-extrabold text-white text-base ${
                          disabledByCredit
                            ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                            : "bg-[#f59e0b] hover:bg-[#e58f0a]"
                        }`}
                        title={
                          disabledByCredit
                            ? "Cart exceeds available credit"
                            : "Proceed to checkout"
                        }
                      >
                        {disabledByCredit
                          ? "Insufficient credit"
                          : "Proceed to Checkout"}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Hydrate>
  );
}
