"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import useSessionStore from "@/store/session-store";
import { Suspense } from "react";
import Hydrate from "@/store/hydrate";

export default function BasketPage() {
  const cart = useSessionStore((s) => s.cart);
  const increase = useSessionStore((s) => s.increase);
  const decrease = useSessionStore((s) => s.decrease);
  const remove = useSessionStore((s) => s.removeFromCart);
  const total = useSessionStore((s) => s.cartTotalPrice());

  return (
    <Hydrate>
      {/* HEADER */}
      <div className="bg-[#f3f3f3] py-20">
        <div className="w-full max-w-[1200px] px-4">
          <h1 className="font-bold text-4xl md:text-5xl">My Cart</h1>
        </div>
      </div>

      {/* CONTENT */}
      <div className="w-full bg-[#fafafa] py-12 mb-20">
        <div className="container mx-auto px-4 flex flex-col gap-10 lg:flex-row">
          {/* LEFT SIDE */}
          <div className="flex-1">
            {cart.length === 0 && (
              <div className="flex items-center justify-center">
                <p className="text-3xl font-bold text-muted-foreground">
                  Your cart is empty.
                </p>
              </div>
            )}

            {cart.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl shadow-sm mb-4 border flex gap-4 items-start"
              >
                {/* IMAGE */}
                <div className="relative w-[70px] h-[70px] min-w-[70px] min-h-[70px] sm:w-[90px] sm:h-[90px] sm:min-w-[90px] sm:min-h-[90px] shrink-0 rounded-lg border">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* PRODUCT INFO */}
                <div className="flex-1 flex flex-col">
                  <p className="font-semibold text-lg">{item.title}</p>

                  {item.subtitle && (
                    <p className="text-sm text-gray-500">{item.subtitle}</p>
                  )}

                  {/* QUANTITY */}
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      className="w-8 h-8 rounded-full border flex justify-center items-center text-xl"
                      onClick={() => decrease(item.id)}
                    >
                      -
                    </button>

                    <span className="text-lg font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      className="w-8 h-8 rounded-full border flex justify-center items-center text-xl"
                      onClick={() => increase(item.id)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* PRICE + DELETE */}
                <div className="flex flex-col items-end gap-2">
                  <button
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 size={22} />
                  </button>

                  <p className="text-orange-600  text-sm font-bold md:text-xl">
                    {(item.price * item.quantity).toLocaleString()} USD
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT SIDE SUMMARY */}
          <div className="w-full lg:w-[350px] bg-white p-6 rounded-xl shadow border h-fit">
            <h2 className="text-xl font-bold mb-4">Order Summary</h2>

            <div className="flex justify-between text-gray-600 mb-2">
              <span>Subtotal</span>
              <span>{total.toLocaleString()} USD</span>
            </div>

            <div className="flex justify-between text-gray-600 mb-4">
              <span>Shipping</span>
              <span className="text-green-600 font-semibold">Free</span>
            </div>

            <div className="flex justify-between text-xl font-bold border-t pt-4 mb-6">
              <span>Total</span>
              <span>{total.toLocaleString()} USD</span>
            </div>

            <button className="w-full bg-secondary text-white py-3 rounded-lg font-semibold text-lg hover:bg-secondary/80">
              Confirm Order
            </button>
          </div>
        </div>
      </div>
    </Hydrate>
  );
}
