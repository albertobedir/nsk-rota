import { User } from "@/generated/prisma/client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  title: string;
  subtitle?: string;
  price: number;
  image: string;
  quantity: number;
  oems?: string[];
  brand?: string;
  model?: string;
}

interface SessionState {
  /* USER */
  user: User | null;
  setUser: (user: User) => void;
  clearSession: () => void;

  /* CART */
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  clearCart: () => void;

  cartTotalItems: () => number;
  cartTotalPrice: () => number;
}

const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      /* -------------------- USER -------------------- */
      user: null,

      setUser: (user) => set({ user }),

      clearSession: () => set({ user: null, cart: [] }),

      /* -------------------- CART -------------------- */
      cart: [],

      addToCart: (item) => {
        const cart = get().cart;
        const exists = cart.find((p) => p.id === item.id);

        if (exists) {
          set({
            cart: cart.map((p) =>
              p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p
            ),
          });
        } else {
          set({
            cart: [...cart, { ...item, quantity: 1 }],
          });
        }
      },

      removeFromCart: (id) =>
        set({
          cart: get().cart.filter((p) => p.id !== id),
        }),

      increase: (id) =>
        set({
          cart: get().cart.map((p) =>
            p.id === id ? { ...p, quantity: p.quantity + 1 } : p
          ),
        }),

      decrease: (id) =>
        set({
          cart: get()
            .cart.map((p) =>
              p.id === id ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p
            )
            .filter((p) => p.quantity > 0),
        }),

      clearCart: () => set({ cart: [] }),

      cartTotalItems: () =>
        get().cart.reduce((sum, item) => sum + item.quantity, 0),

      cartTotalPrice: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: "rota-session-storage", // both user + cart stored here
    }
  )
);

export default useSessionStore;
