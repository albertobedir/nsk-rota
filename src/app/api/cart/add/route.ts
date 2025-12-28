import { NextRequest, NextResponse } from "next/server";
import { addCartLines, addItemToCart } from "@/lib/shopify/cart";
import { ensureCart } from "../_helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cart, cartId, created } = await ensureCart(request);

    if (!cartId)
      return NextResponse.json(
        { message: "Cart not available" },
        { status: 400 }
      );

    let result: any = null;

    if (Array.isArray(body.lines)) {
      result = await addCartLines(cartId, body.lines);
    } else if (body.merchandiseId) {
      const qty = typeof body.quantity === "number" ? body.quantity : 1;
      result = await addItemToCart(cartId, body.merchandiseId, qty);
    } else {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const res = NextResponse.json({ result });
    if (created && cartId) {
      res.cookies.set("shopifyCartId", cartId, {
        httpOnly: true,
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }
    return res;
  } catch (err) {
    console.error("POST /api/cart/add error:", err);
    return NextResponse.json(
      { message: "Error adding to cart" },
      { status: 500 }
    );
  }
}
