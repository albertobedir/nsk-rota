/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Invoice from "@/schemas/mongoose/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_ORDERS_QUERY = `
  query getCustomerInvoiceOrders($customerId: ID!, $first: Int!) {
    customer(id: $customerId) {
      id
      email
      firstName
      lastName
      phone
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            orderNumber
            createdAt
            updatedAt
            displayFinancialStatus
            displayFulfillmentStatus
            confirmed
            cancelledAt
            cancelReason
            currencyCode
            subtotalPriceSet {
              shopMoney { amount currencyCode }
            }
            totalPriceSet { shopMoney { amount currencyCode } }
            totalShippingPriceSet { shopMoney { amount currencyCode } }
            totalTaxSet { shopMoney { amount currencyCode } }
            totalDiscountsSet { shopMoney { amount currencyCode } }
            taxExempt
            taxesIncluded
            taxLines { title rate ratePercentage priceSet { shopMoney { amount currencyCode } } }
            billingAddress {
              firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone
            }
            shippingAddress {
              firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone
            }
            lineItems(first: 50) {
              edges { node {
                id title name quantity sku vendor
                originalUnitPriceSet { shopMoney { amount currencyCode } }
                discountedUnitPriceSet { shopMoney { amount currencyCode } }
                originalTotalSet { shopMoney { amount currencyCode } }
                discountedTotalSet { shopMoney { amount currencyCode } }
                taxable
                taxLines { title rate ratePercentage priceSet { shopMoney { amount currencyCode } } }
                variant { id title sku image { url altText } }
                discountAllocations { allocatedAmountSet { shopMoney { amount currencyCode } } }
              } }
            }
            shippingLines(first: 10) { edges { node {
              title code originalPriceSet { shopMoney { amount currencyCode } }
              discountedPriceSet { shopMoney { amount currencyCode } }
              taxLines { title rate priceSet { shopMoney { amount currencyCode } } }
            } } }
            discountCodes
            note
            customer { id email firstName lastName phone }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function safeNum(v: any) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    const orderId = url.searchParams.get("orderId");

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Customer ID required" },
        { status: 400 },
      );
    }

    const variables = {
      customerId: `gid://shopify/Customer/${customerId}`,
      first: orderId ? 1 : 50,
    };

    const resp = await shopifyAdminFetch({
      query: INVOICE_ORDERS_QUERY,
      variables,
    });
    const orders =
      resp?.data?.customer?.orders?.edges?.map((e: any) => e.node) ?? [];

    const invoices = orders.map((order: any) => ({
      invoiceNumber: order.name,
      orderNumber: order.orderNumber,
      orderId: order.id,
      invoiceDate: order.createdAt,
      customer: {
        id: order.customer?.id,
        name: `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim(),
        email: order.customer?.email,
        phone: order.customer?.phone,
      },
      billingAddress: order.billingAddress || null,
      shippingAddress: order.shippingAddress || null,
      items: (order.lineItems?.edges ?? []).map((liEdge: any) => {
        const li = liEdge?.node || {};
        return {
          name: li.title,
          sku: li.sku,
          quantity: Number(li.quantity || 0),
          unitPrice: safeNum(li.originalUnitPriceSet?.shopMoney?.amount),
          totalPrice: safeNum(li.originalTotalSet?.shopMoney?.amount),
          discountedPrice: safeNum(li.discountedTotalSet?.shopMoney?.amount),
          tax: (li.taxLines || []).reduce(
            (sum: number, t: any) =>
              sum + safeNum(t.priceSet?.shopMoney?.amount),
            0,
          ),
          taxRate: li.taxLines?.[0]?.ratePercentage ?? 0,
          image: li.variant?.image?.url ?? null,
          raw: li,
        };
      }),
      shipping: ((order.shippingLines?.edges ?? []).map((s: any) => s.node) ||
        [])[0]
        ? {
            method: order.shippingLines.edges[0].node.title,
            price: safeNum(
              order.shippingLines.edges[0].node.originalPriceSet?.shopMoney
                ?.amount,
            ),
            tax: (order.shippingLines.edges[0].node.taxLines || []).reduce(
              (sum: number, t: any) =>
                sum + safeNum(t.priceSet?.shopMoney?.amount),
              0,
            ),
          }
        : null,
      subtotal: safeNum(order.subtotalPriceSet?.shopMoney?.amount),
      totalTax: safeNum(order.totalTaxSet?.shopMoney?.amount),
      totalShipping: safeNum(order.totalShippingPriceSet?.shopMoney?.amount),
      totalDiscount: safeNum(order.totalDiscountsSet?.shopMoney?.amount),
      grandTotal: safeNum(order.totalPriceSet?.shopMoney?.amount),
      taxLines: (order.taxLines || []).map((t: any) => ({
        title: t.title,
        rate: t.ratePercentage,
        amount: safeNum(t.priceSet?.shopMoney?.amount),
      })),
      currency: order.currencyCode,
      status: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
      note: order.note,
      discountCodes: order.discountCodes || [],
      raw: order,
    }));

    // Persist to MongoDB (optional)
    try {
      await connectDB();
      for (const invoice of invoices) {
        await Invoice.findOneAndUpdate(
          { orderId: invoice.orderId },
          { $set: invoice },
          { upsert: true, new: true },
        );
      }
    } catch (e) {
      console.error("Invoice persist error:", e);
    }

    if (orderId && invoices.length > 0) {
      return NextResponse.json({ ok: true, invoice: invoices[0] });
    }

    return NextResponse.json({ ok: true, invoices });
  } catch (err) {
    console.error("Invoice route error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
