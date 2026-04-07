/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";

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
            totalShippingPriceSet {
              shopMoney { amount currencyCode }
            }
            totalTaxSet {
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
            fulfillments(first: 10) {
              trackingInfo(first: 5) {
                company
                number
                url
              }
              status
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
                  variant {
                    id
                    title
                    image { url }
                  }
                  originalUnitPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  discountedUnitPriceSet {
                    shopMoney { amount currencyCode }
                  }
                }
              }
            }
            shippingAddress {
              address1 address2 city zip province country countryCode
            }
            billingAddress {
              address1 address2 city zip province country countryCode
            }
          }
        }
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    // read email from a custom header set by the client (zustand session)
    const emailHeader = req.headers.get("x-user-email");
    const email = emailHeader ?? new URL(req.url).searchParams.get("email");
    const customerId = new URL(req.url).searchParams.get("customerId");

    if (!email && !customerId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized or missing customer identifier" },
        { status: 401 },
      );
    }

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

      console.log("=== SHOPIFY RESP ===");
      console.log("errors:", JSON.stringify(resp?.errors, null, 2));
      console.log("customer:", JSON.stringify(resp?.data?.customer, null, 2));
      console.log("=== END ===");

      const edges = resp?.data?.customer?.orders?.edges ?? [];
      const orders = edges.map((e: any) => e.node);
      // persist to Mongo
      try {
        await connectDB();
        for (const o of orders) {
          let shopifyId = "";
          if (typeof o.id === "string") shopifyId = String(o.id).split("?")[0];
          else if (typeof o.admin_graphql_api_id === "string")
            shopifyId = String(o.admin_graphql_api_id).split("?")[0];

          const orderNumber = o.orderNumber
            ? Number(o.orderNumber)
            : o.name
              ? Number(String(o.name).replace(/^#/, ""))
              : undefined;

          if (!shopifyId && o.id) shopifyId = String(o.id);

          if (shopifyId) {
            try {
              await Order.findOneAndUpdate(
                { shopifyId },
                {
                  $set: {
                    shopifyId,
                    orderNumber: orderNumber ?? undefined,
                    name: o.name ?? undefined,
                    billingAddress: o.billingAddress ?? undefined,
                    shippingAddress: o.shippingAddress ?? undefined,
                    raw: o,
                  },
                },
                { upsert: true, new: true },
              );
            } catch (e) {
              console.error("Order upsert error", e);
            }
          }
        }
      } catch (e) {
        console.error("Mongo persist error:", e);
      }
      return NextResponse.json({ ok: true, orders });
    }

    // fallback: use REST orders.json by email
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const r = await fetch(
      `https://${domain}/admin/api/2024-10/orders.json?email=${encodeURIComponent(
        email!,
      )}&status=any&limit=250`,
      {
        headers: { "X-Shopify-Access-Token": token || "" },
      },
    );
    if (!r.ok) throw new Error("Shopify REST request failed");
    const data = await r.json();
    const orders = data.orders ?? [];

    // persist REST orders to Mongo
    try {
      await connectDB();
      for (const o of orders) {
        let shopifyId = "";
        if (typeof o.id === "number" || typeof o.id === "string")
          shopifyId = String(o.id);
        else if (o.admin_graphql_api_id)
          shopifyId = String(o.admin_graphql_api_id).split("?")[0];

        const orderNumber =
          o.order_number ??
          (o.name ? Number(String(o.name).replace(/^#/, "")) : undefined);

        if (shopifyId) {
          try {
            await Order.findOneAndUpdate(
              { shopifyId },
              {
                $set: {
                  shopifyId,
                  orderNumber: orderNumber ?? undefined,
                  name: o.name ?? undefined,
                  billingAddress: o.billing_address ?? undefined,
                  shippingAddress: o.shipping_address ?? undefined,
                  raw: o,
                },
              },
              { upsert: true, new: true },
            );
          } catch (e) {
            console.error("Order upsert error", e);
          }
        }
      }
    } catch (e) {
      console.error("Mongo persist error:", e);
    }

    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("orders route error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
