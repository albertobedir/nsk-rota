import { NextRequest } from "next/server";
import { createCart, getCart } from "@/lib/shopify/cart";

export async function ensureCart(request: NextRequest) {
  const existing = request.cookies.get("shopifyCartId")?.value;

  if (existing) {
    try {
      const cart = await getCart(existing);
      if (cart && cart.id) return { cart, cartId: cart.id, created: false };
    } catch (e) {
      // ignore and try to create a new cart
    }
  }

  const created = await createCart();
  const newCart = created?.cart ?? null;
  return { cart: newCart, cartId: newCart?.id ?? null, created: true };
}
