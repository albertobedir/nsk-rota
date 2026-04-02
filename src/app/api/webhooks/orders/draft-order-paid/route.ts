/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

/**
 * Webhook handler for draft_orders/update event
 * Triggers when a draft order is marked as completed/paid
 *
 * This webhook:
 * 1. Extracts the original order ID from the draft order note
 * 2. Marks the original order as PAID (financial status)
 * 3. Does NOT modify customer's credit (they paid with credit card)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Webhook payload structure for draft_orders/update
    const { id: draftOrderId, name, note, status } = body;

    console.log("[webhook/draft-order-paid] Received:", {
      draftOrderId,
      draftOrderName: name,
      status,
    });

    // Only process if draft order is completed/paid
    if (status !== "completed" && status !== "invoiced") {
      console.log(
        `[webhook/draft-order-paid] Skipping — status is "${status}", not "completed" or "invoiced"`,
      );
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 1. Parse original order ID from note
    // Note format: "Credit card payment — Original Order: #1015 (gid://shopify/Order/6967864688943)"
    const orderGidMatch = note?.match(/gid:\/\/shopify\/Order\/(\d+)/);

    if (!orderGidMatch) {
      console.warn(
        "[webhook/draft-order-paid] Could not extract order ID from note:",
        note,
      );
      return NextResponse.json({ ok: true, noOrderFound: true });
    }

    const originalOrderGid = `gid://shopify/Order/${orderGidMatch[1]}`;

    console.log("[webhook/draft-order-paid] Marking order as paid:", {
      originalOrderGid,
      draftOrderId,
    });

    // 2. Mark original order as PAID using Shopify mutation
    const markAsPaidResponse = await shopifyAdminFetch({
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
      variables: {
        input: {
          id: originalOrderGid,
        },
      },
    });

    if (markAsPaidResponse.errors) {
      console.error(
        "[webhook/draft-order-paid] Mutation error:",
        markAsPaidResponse.errors,
      );
      return NextResponse.json(
        { message: "Failed to mark order as paid" },
        { status: 500 },
      );
    }

    const userErrors =
      markAsPaidResponse.data?.orderMarkAsPaid?.userErrors || [];
    if (userErrors.length > 0) {
      console.warn("[webhook/draft-order-paid] User errors:", userErrors);
    }

    const updatedOrder = markAsPaidResponse.data?.orderMarkAsPaid?.order;
    console.log("[webhook/draft-order-paid] Order updated successfully:", {
      orderId: updatedOrder?.id,
      orderName: updatedOrder?.name,
      financialStatus: updatedOrder?.financialStatus,
    });

    // 3. Return success
    // Note: We do NOT modify customer credit here
    // (They paid with credit card, not using their credit balance)
    return NextResponse.json({
      ok: true,
      originalOrderId: originalOrderGid,
      draftOrderId,
      financialStatus: updatedOrder?.financialStatus,
    });
  } catch (err: any) {
    console.error("[webhook/draft-order-paid] Error:", err);
    return NextResponse.json(
      { message: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
