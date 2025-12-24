/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Local session user shape to decouple from generated client until `prisma generate` is run
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  customerCode?: string | null;
  deliveryTerms?: string | null;
  paymentTerms?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  zip?: string | null;
  billingAddress?: any | null;
  shippingAddress?: any | null;
  emailVerified?: Date | null;
  role?: "user" | "admin";
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  // Credit info (client-side numbers)
  creditLimit?: number | null;
  creditUsed?: number | null;
  creditRemaining?: number | null;
}

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
  variantId: string;
}

interface SessionState {
  /* USER */
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
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
        const qtyToAdd = Math.max(1, Math.floor(item.quantity || 1));
        const exists = cart.find((p) => p.id === item.id);

        if (exists) {
          set({
            cart: cart.map((p) =>
              p.id === item.id ? { ...p, quantity: p.quantity + qtyToAdd } : p
            ),
          });
        } else {
          set({
            cart: [...cart, { ...item, quantity: qtyToAdd }],
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

// DEV helper: populate session with fake data for local development/testing
export function seedSession() {
  try {
    useSessionStore.getState().setUser({
      id: "dev-user",
      email: "dev@example.com",
      name: "Developer",
      firstName: "Dev",
      lastName: "User",
      phone: "+90 555 555 5555",
      customerCode: "DEV001",
      deliveryTerms: "DAP",
      paymentTerms: "Net 30",
      addressLine1: "Test Street 123",
      addressLine2: "Floor 2",
      city: "Istanbul",
      zip: "34100",
      billingAddress: { company: "Dev Co", vat: "TR123456" },
      shippingAddress: { company: "Dev Co", contact: "Dev User" },
      emailVerified: new Date(),
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      creditLimit: 10000,
      creditUsed: 2000,
      creditRemaining: 8000,
    });
  } catch (e) {
    // swallow in case called in non-browser contexts
    console.warn("seedSession failed", e);
  }
}

export function clearSeedSession() {
  try {
    useSessionStore.getState().clearSession();
  } catch (e) {
    console.warn("clearSeedSession failed", e);
  }
}
