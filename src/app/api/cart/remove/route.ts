/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  removeCartLines,
  removeItemFromCart,
  getCart,
} from "@/lib/shopify/cart";
import { ensureCart } from "../_helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cart, cartId, created } = await ensureCart(request);

    if (!cartId)
      return NextResponse.json(
        { message: "Cart not available" },
        { status: 400 },
      );

    let result: any = null;

    if (Array.isArray(body.lineIds)) {
      result = await removeCartLines(cartId, body.lineIds);
    } else if (body.lineId) {
      result = await removeItemFromCart(cartId, body.lineId);
    } else if (body.merchandiseId) {
      // try to find matching line in cart
      const current = await getCart(cartId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const edges = current?.lines?.edges ?? [];

      // Normalize GID or plain numeric id to just the numeric part for comparison
      const extractId = (v: unknown) => {
        const s = String(v ?? "");
        const m = s.match(/(\d+)$/);
        return m ? m[1] : s;
      };
      const targetId = extractId(body.merchandiseId);

      const match = edges.find(
        (e: any) =>
          extractId(e.node?.merchandise?.id) === targetId ||
          extractId(e.node?.merchandise?.product?.id) === targetId,
      );

      // Item not in Shopify cart (local-only); succeed silently
      if (!match) {
        return NextResponse.json({ result: null, skipped: true });
      }

      result = await removeItemFromCart(cartId, match.node.id);
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
    console.error("POST /api/cart/remove error:", err);
    return NextResponse.json(
      { message: "Error removing from cart" },
      { status: 500 },
    );
  }
}
