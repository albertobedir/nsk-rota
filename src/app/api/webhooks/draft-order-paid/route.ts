/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

/**
 * Webhook handler for draft_orders/update event
 * Shopify Admin → Settings → Notifications → Webhooks:
 *   Topic:   Draft orders - Update
 *   URL:     https://siten.com/api/webhooks/draft-order-paid
 *
 * Triggers when a draft order is marked as completed/paid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Webhook payload from Shopify
    const { id: draftOrderId, status, tags, note2 } = body;

    console.log("[draft-order-paid webhook]", {
      id: draftOrderId,
      status,
      tags,
      note: note2,
    });

    // Only process draft orders with credit-card-payment tag and completed status
    const tagList: string[] = tags ?? [];
    const statusStr: string = status ?? "";

    if (!tagList.includes("credit-card-payment")) {
      return NextResponse.json({ ok: true, skipped: "no tag" });
    }

    if (statusStr !== "completed") {
      return NextResponse.json({ ok: true, skipped: "not completed" });
    }

    // Parse original order GID from note2
    const note: string = note2 ?? "";
    const match = note.match(/gid:\/\/shopify\/Order\/(\d+)/);

    if (!match) {
      console.warn(
        "[draft-order-paid] original order ID not found, note:",
        note,
      );
      return NextResponse.json({ ok: true, skipped: "no order ref" });
    }

    const originalOrderGid = `gid://shopify/Order/${match[1]}`;
    console.log(
      "[draft-order-paid] marking original order as PAID:",
      originalOrderGid,
    );

    // Mark original order as PAID
    const response = await shopifyAdminFetch({
      query: `
        mutation markAsPaid($input: OrderMarkAsPaidInput!) {
          orderMarkAsPaid(input: $input) {
            order {
              id
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

    const userErrors = response?.data?.orderMarkAsPaid?.userErrors ?? [];
    if (userErrors.length > 0) {
      console.error("[draft-order-paid] markAsPaid userErrors:", userErrors);
    } else {
      console.log(
        "[draft-order-paid] ✅ order marked as PAID:",
        originalOrderGid,
      );
    }

    // NOTE: do not touch credit_remaining — paid with credit card

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[draft-order-paid] Webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
