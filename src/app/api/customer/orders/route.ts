import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CUSTOMER_ORDERS_Q = `
  query getCustomerOrders($customerId: ID!, $first: Int!) {
    customer(id: $customerId) {
      id
      email
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
            discountApplications(first: 10) {
              edges {
                node {
                  allocationMethod
                  targetSelection
                  targetType
                  value {
                    ... on MoneyV2 { amount currencyCode }
                    ... on PricingPercentageValue { percentage }
                  }
                  ... on DiscountCodeApplication { code }
                  ... on ManualDiscountApplication { title description }
                  ... on ScriptDiscountApplication { title description }
                }
              }
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  discountAllocations {
                    allocatedAmountSet {
                      shopMoney { amount currencyCode }
                    }
                    discountApplication {
                      allocationMethod
                      targetSelection
                      targetType
                      value {
                        ... on MoneyV2 { amount currencyCode }
                        ... on PricingPercentageValue { percentage }
                      }
                      ... on ManualDiscountApplication { title description }
                    }
                  }
                  variant { id title image { url } }
                  originalUnitPriceSet { shopMoney { amount currencyCode } }
                  discountedUnitPriceSet { shopMoney { amount currencyCode } }
                }
              }
            }
            shippingAddress { address1 address2 city zip province country countryCode }
            billingAddress { address1 address2 city zip province country countryCode }
            totalShippingPriceSet { shopMoney { amount currencyCode } }
            totalTaxSet {
              shopMoney { amount currencyCode }
            }
            fulfillments(first: 10) {
              trackingCompany
              trackingInfo(first: 5) {
                company
                number
                url
              }
              status
            }
          }
        }
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    const email = url.searchParams.get("email");

    // prefer GraphQL by customerId
    if (customerId) {
      const rawId = customerId.includes("gid://")
        ? customerId
        : `gid://shopify/Customer/${customerId}`;

      const variables = {
        customerId: rawId,
        first: 50,
      };
      const resp = await shopifyAdminFetch({
        query: CUSTOMER_ORDERS_Q,
        variables,
      });
      const edges = resp?.data?.customer?.orders?.edges ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = edges.map((e: any) => e.node);
      return NextResponse.json({ ok: true, orders });
    }

    // fallback: if email provided, call REST orders endpoint
    if (email) {
      const domain = process.env.SHOPIFY_STORE_DOMAIN;
      const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
      const r = await fetch(
        `https://${domain}/admin/api/2024-10/orders.json?email=${encodeURIComponent(
          email,
        )}&status=any&limit=250`,
        { headers: { "X-Shopify-Access-Token": token || "" } },
      );
      if (!r.ok) throw new Error("Shopify REST request failed");
      const data = await r.json();
      return NextResponse.json({ ok: true, orders: data.orders ?? [] });
    }

    return NextResponse.json(
      { ok: false, error: "customerId or email required" },
      { status: 400 },
    );
  } catch (err) {
    console.error("customer orders error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
