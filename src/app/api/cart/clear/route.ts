import { NextRequest, NextResponse } from "next/server";
import { getCart, removeCartLines } from "@/lib/shopify/cart";
import { ensureCart } from "../_helpers";

export async function POST(request: NextRequest) {
  try {
    const { cart, cartId, created } = await ensureCart(request);

    if (!cartId)
      return NextResponse.json(
        { message: "Cart not available" },
        { status: 400 }
      );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = await getCart(cartId);
    const lineIds = current?.lines?.edges?.map((e: any) => e.node.id) ?? [];

    if (lineIds.length === 0)
      return NextResponse.json({ message: "Cart already empty" });

    const result = await removeCartLines(cartId, lineIds);
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
    console.error("POST /api/cart/clear error:", err);
    return NextResponse.json(
      { message: "Error clearing cart" },
      { status: 500 }
    );
  }
}
