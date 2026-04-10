import { NextRequest, NextResponse } from "next/server";
import {
  getCart,
  updateCartLines,
  updateItemQuantity,
} from "@/lib/shopify/cart";
import { ensureCart } from "../_helpers";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { cartId, created } = await ensureCart(request);

    if (!cartId)
      return NextResponse.json(
        { message: "Cart not available" },
        { status: 400 },
      );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;

    if (Array.isArray(body.lines)) {
      // lines: [{ id: string, quantity: number }]
      result = await updateCartLines(cartId, body.lines);
    } else if (body.lineId && typeof body.quantity === "number") {
      result = await updateItemQuantity(cartId, body.lineId, body.quantity);
    } else if (body.merchandiseId && typeof body.quantity === "number") {
      // find the matching line on server-side cart
      const current = await getCart(cartId);

      const edges = current?.lines?.edges ?? [];

      // Normalize a Shopify GID or plain numeric id to just the numeric part for comparison
      const extractId = (v: unknown) => {
        const s = String(v ?? "");
        const m = s.match(/(\d+)$/);
        return m ? m[1] : s;
      };
      const targetId = extractId(body.merchandiseId);

      const match = edges.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) =>
          extractId(e.node?.merchandise?.id) === targetId ||
          extractId(e.node?.merchandise?.product?.id) === targetId,
      );

      if (!match) {
        // Item not in Shopify cart (local-only); succeed silently so UI isn't disrupted
        return NextResponse.json({ result: null, skipped: true });
      }

      result = await updateItemQuantity(cartId, match.node.id, body.quantity);
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
    console.error("PATCH /api/cart/update error:", err);
    return NextResponse.json(
      { message: "Error updating cart" },
      { status: 500 },
    );
  }
}
