/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Invoice from "@/schemas/mongoose/invoice";
import Order from "@/schemas/mongoose/order";
import {
  buildCustomerOrderMongoQuery,
  resolveCustomerIdentity,
} from "@/lib/orders/customer";
import { formatOrderMoney, normalizeLineItemEdges } from "@/lib/orders/line-items";
import { parseOrderTags } from "@/lib/orders/status";
import { extractNumericId, toOrderGid } from "@/lib/shopify/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_ORDERS_QUERY = `
  query getCustomerInvoiceOrders($customerId: ID!, $first: Int!, $after: String) {
    customer(id: $customerId) {
      id
      email
      firstName
      lastName
      phone
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            orderNumber
            poNumber
            createdAt
            updatedAt
            displayFinancialStatus
            displayFulfillmentStatus
            cancelledAt
            cancelReason
            tags
            currencyCode
            paymentTerms {
              dueInDays
              paymentSchedules(first: 5) {
                dueAt
                completedAt
                issuedAt
              }
            }
            transactions(first: 20) {
              kind
              status
              authorizationExpiresAt
            }
            subtotalPriceSet {
              shopMoney { amount currencyCode }
            }
            totalPriceSet { shopMoney { amount currencyCode } }
            totalShippingPriceSet { shopMoney { amount currencyCode } }
            totalTaxSet { shopMoney { amount currencyCode } }
            totalDiscountsSet { shopMoney { amount currencyCode } }
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
                variant { id title sku image { url altText } product { id } }
                discountAllocations { allocatedAmountSet { shopMoney { amount currencyCode } } }
              } }
            }
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

function mapShopifyOrderToInvoice(order: any) {
  return {
    invoiceNumber: order.name,
    orderNumber: order.orderNumber,
    poNumber: order.poNumber || null,
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
        image: li.variant?.image?.url ?? null,
        raw: li,
      };
    }),
    subtotal: safeNum(order.subtotalPriceSet?.shopMoney?.amount),
    totalTax: safeNum(order.totalTaxSet?.shopMoney?.amount),
    totalShipping: safeNum(order.totalShippingPriceSet?.shopMoney?.amount),
    totalDiscount: safeNum(order.totalDiscountsSet?.shopMoney?.amount),
    grandTotal: safeNum(order.totalPriceSet?.shopMoney?.amount),
    currency: order.currencyCode,
    status: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    cancelledAt: order.cancelledAt || null,
    tags: parseOrderTags(order),
    raw: order,
  };
}

function mapMongoOrderToInvoice(order: any) {
  const raw = order.raw || {};
  const money = formatOrderMoney(order);
  const lineItems = normalizeLineItemEdges(order);

  return {
    invoiceNumber: order.name || raw.name || `#${order.orderNumber || ""}`,
    orderNumber: order.orderNumber,
    poNumber: order.poNumber || raw.po_number || raw.poNumber || null,
    orderId: order.shopifyId || raw.admin_graphql_api_id || raw.id,
    invoiceDate: raw.created_at || raw.createdAt || order.createdAt,
    customer: raw.customer || null,
    billingAddress: order.billingAddress || raw.billing_address || null,
    shippingAddress: order.shippingAddress || raw.shipping_address || null,
    items: lineItems.map((e: any) => {
      const node = e.node || {};
      const qty = Number(node.quantity || 0);
      const unit = safeNum(node.discountedUnitPrice ?? node.originalUnitPrice);
      return {
        name: node.title,
        sku: node.sku,
        quantity: qty,
        unitPrice: safeNum(node.originalUnitPrice),
        totalPrice: unit * qty,
        discountedPrice: unit * qty,
        image: node.variant?.image?.url ?? null,
      };
    }),
    grandTotal: safeNum(money.amount),
    currency: money.currency,
    status: order.financialStatus || raw.financial_status || raw.displayFinancialStatus,
    fulfillmentStatus:
      order.fulfillmentStatus ||
      raw.fulfillment_status ||
      raw.displayFulfillmentStatus,
    cancelledAt: order.cancelledAt || raw.cancelled_at || null,
    tags: parseOrderTags(order),
    raw: order,
  };
}

async function fetchShopifyInvoices(customerGid: string, orderId?: string | null) {
  const invoices: any[] = [];
  let after: string | null = null;
  const targetNumeric = orderId ? extractNumericId(orderId) : null;

  for (let page = 0; page < 5; page += 1) {
    const resp: any = await shopifyAdminFetch({
      query: INVOICE_ORDERS_QUERY,
      variables: {
        customerId: customerGid,
        first: 50,
        after: after || null,
      },
    });

    if (resp?.errors?.length) {
      console.error("Invoice Shopify GraphQL errors:", resp.errors);
      break;
    }

    const connection = resp?.data?.customer?.orders;
    const nodes = connection?.edges?.map((e: any) => e.node) ?? [];
    invoices.push(...nodes.map(mapShopifyOrderToInvoice));

    if (targetNumeric) {
      const match = invoices.find(
        (inv) => extractNumericId(inv.orderId) === targetNumeric,
      );
      if (match) return [match];
    }

    if (!connection?.pageInfo?.hasNextPage || !connection?.pageInfo?.endCursor) {
      break;
    }
    after = connection.pageInfo.endCursor;
  }

  if (targetNumeric) {
    return invoices.filter(
      (inv) => extractNumericId(inv.orderId) === targetNumeric,
    );
  }

  return invoices;
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

    const identity = await resolveCustomerIdentity(customerId);
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: "Customer ID required" },
        { status: 400 },
      );
    }

    await connectDB();

    const customerQuery = buildCustomerOrderMongoQuery(identity);
    const mongoQuery = orderId
      ? {
          $and: [
            customerQuery,
            {
              $or: [
                { shopifyId: orderId },
                ...(toOrderGid(orderId) ? [{ shopifyId: toOrderGid(orderId) }] : []),
                ...(extractNumericId(orderId)
                  ? [
                      { shopifyId: extractNumericId(orderId) },
                      { orderNumber: Number(extractNumericId(orderId)) },
                    ]
                  : []),
              ],
            },
          ],
        }
      : customerQuery;

    const mongoOrders = await Order.find(mongoQuery)
      .sort({ createdAt: -1 })
      .lean();

    let invoices = mongoOrders.map(mapMongoOrderToInvoice);

    if (invoices.length === 0 && identity.gid) {
      try {
        invoices = await fetchShopifyInvoices(identity.gid, orderId);
      } catch (shopifyErr) {
        console.error("Invoice Shopify fallback error:", shopifyErr);
      }
    }

    try {
      for (const invoice of invoices) {
        await Invoice.findOneAndUpdate(
          { orderId: String(invoice.orderId) },
          { $set: invoice },
          { upsert: true, new: true },
        );
      }
    } catch (e) {
      console.error("Invoice persist error:", e);
    }

    if (orderId) {
      return NextResponse.json({
        ok: true,
        invoice: invoices[0] || null,
        invoices,
      });
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
