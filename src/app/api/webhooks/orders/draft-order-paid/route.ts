/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[draft-order-paid webhook]", {
      draftOrderId: body.id,
      status: body.status,
      tags: body.tags,
      note: body.note2,
      newOrderId: body.order_id,
    });

    const tags: string[] = body.tags ?? [];
    const status: string = body.status ?? "";

    if (!tags.includes("credit-card-payment")) {
      return NextResponse.json({ ok: true, skipped: "no tag" });
    }

    if (status !== "completed") {
      return NextResponse.json({ ok: true, skipped: "not completed" });
    }

    const note: string = body.note2 ?? body.note ?? "";

    // Shopify numeric ID'yi yakala — GID veya sadece rakam
    // "gid://shopify/Order/6967864688943" → 6967864688943
    // "Original Order: #1019 (6967864688943)" → 6967864688943 (son parantez içi)
    const gidMatch = note.match(/gid:\/\/shopify\/Order\/(\d+)/);
    const parenMatch = note.match(/\((\d+)\)\s*$/); // parantez içindeki numeric ID

    const originalOrderNumericId = gidMatch?.[1] ?? parenMatch?.[1] ?? null;

    if (!originalOrderNumericId) {
      console.warn(
        "[draft-order-paid] original order ID parse edilemedi, note:",
        note,
      );
      return NextResponse.json({ ok: true, skipped: "no order ref" });
    }

    const originalOrderGid = `gid://shopify/Order/${originalOrderNumericId}`;
    const newOrderGid = body.order_id
      ? `gid://shopify/Order/${body.order_id}`
      : null;

    console.log("[draft-order-paid] processing:", {
      originalOrderGid,
      newOrderGid,
    });

    // Orijinal siparişi PAID yap
    const paidResult = await shopifyAdminFetch({
      query: `
        mutation markAsPaid($input: OrderMarkAsPaidInput!) {
          orderMarkAsPaid(input: $input) {
            order {
              id
              name
              displayFinancialStatus
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: { input: { id: originalOrderGid } },
    });

    const markAsPaidErrors =
      paidResult?.data?.orderMarkAsPaid?.userErrors ?? [];
    if (markAsPaidErrors.length > 0) {
      console.error("[draft-order-paid] markAsPaid errors:", markAsPaidErrors);
    } else {
      console.log(
        "[draft-order-paid] ✅ original order PAID:",
        paidResult?.data?.orderMarkAsPaid?.order,
      );
    }

    // Draft'tan gelen yeni order'ı iptal et
    if (newOrderGid) {
      const cancelResult = await shopifyAdminFetch({
        query: `
          mutation cancelOrder($orderId: ID!, $reason: OrderCancelReason!) {
            orderCancel(orderId: $orderId, reason: $reason, refund: false, restock: false) {
              job { id }
              userErrors { field message }
            }
          }
        `,
        variables: { orderId: newOrderGid, reason: "OTHER" },
      });

      const cancelErrors = cancelResult?.data?.orderCancel?.userErrors ?? [];
      if (cancelErrors.length > 0) {
        console.warn("[draft-order-paid] cancel errors:", cancelErrors);
      } else {
        console.log(
          "[draft-order-paid] ✅ yeni order iptal edildi:",
          newOrderGid,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      originalOrderId: originalOrderGid,
      newOrderCancelled: !!newOrderGid,
    });
  } catch (err: any) {
    console.error("[draft-order-paid] webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
