/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

/**
 * Webhook handler for draft_orders/update event
 * Shopify Admin → Settings → Notifications → Webhooks:
 *   Topic:   Draft orders - Update
 *   URL:     https://siten.com/api/webhooks/draft-order-paid
 *
 * Strategy:
 * 1. Mark original order as PAID (preserves all order details, metafields, etc.)
 * 2. Cancel the newly created order from the draft order (cleanup)
 * 3. Leave customer credit untouched (paid with credit card)
 */
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

    // Only process draft orders with credit-card-payment tag and completed status
    if (!tags.includes("credit-card-payment")) {
      return NextResponse.json({ ok: true, skipped: "no tag" });
    }

    if (status !== "completed") {
      return NextResponse.json({ ok: true, skipped: "not completed" });
    }

    // 1. Parse original order GID from note2
    const note: string = body.note2 ?? "";
    const match = note.match(/gid:\/\/shopify\/Order\/(\d+)/);

    if (!match) {
      console.warn("[draft-order-paid] original order not found, note:", note);
      return NextResponse.json({ ok: true, skipped: "no order ref" });
    }

    const originalOrderGid = `gid://shopify/Order/${match[1]}`;

    // 2. Get the newly created order GID from the draft order completion
    // body.order_id comes in REST format (numeric ID)
    const newOrderGid = body.order_id
      ? `gid://shopify/Order/${body.order_id}`
      : null;

    console.log("[draft-order-paid] processing:", {
      originalOrderGid,
      newOrderGid,
    });

    // 3. Mark original order as PAID
    // This preserves all original order details (products, metafields, tags, etc.)
    const paidResult = await shopifyAdminFetch({
      query: `
        mutation markAsPaid($input: OrderMarkAsPaidInput!) {
          orderMarkAsPaid(input: $input) {
            order {
              id
              name
              financialStatus
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
        "[draft-order-paid] ✅ original order marked as PAID:",
        originalOrderGid,
      );
    }

    // 4. Cancel the newly created order from draft (cleanup duplicate)
    if (newOrderGid) {
      const cancelResult = await shopifyAdminFetch({
        query: `
          mutation cancelOrder($orderId: ID!, $reason: OrderCancelReason!) {
            orderCancel(orderId: $orderId, reason: $reason, refund: false, restock: false) {
              job {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          orderId: newOrderGid,
          reason: "OTHER",
        },
      });

      const cancelErrors = cancelResult?.data?.orderCancel?.userErrors ?? [];
      if (cancelErrors.length > 0) {
        console.warn(
          "[draft-order-paid] cancel new order errors:",
          cancelErrors,
        );
      } else {
        console.log(
          "[draft-order-paid] ✅ new draft order cancelled:",
          newOrderGid,
        );
      }
    }

    // NOTE: do not touch credit_remaining — paid with credit card

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
