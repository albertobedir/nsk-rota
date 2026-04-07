/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyWebhook(req: NextRequest, rawBody: string) {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

async function fetchOrderPaymentGateway(orderId: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const query = `
    query getOrder($id: ID!) {
      order(id: $id) {
        paymentGatewayNames
        customer {
          id
          creditLimit: metafield(namespace: "custom", key: "credit_limit") {
            value
          }
          creditRemaining: metafield(namespace: "custom", key: "credit_remaining") {
            value
          }
          creditUsed: metafield(namespace: "custom", key: "credit_used") {
            value
          }
        }
        transactions {
          gateway
          kind
          status
        }
      }
    }
  `;

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken!,
      },
      body: JSON.stringify({ query, variables: { id: orderId } }),
    },
  );

  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    return null;
  }

  return data.data?.order || null;
}

async function updateCustomerCredit(
  customerId: string,
  orderAmount: number,
  currencyCode: string,
) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopifyDomain || !accessToken) {
    return {
      success: false,
      errors: [{ message: "Missing Shopify config" }],
    };
  }

  if (!customerId || Number.isNaN(orderAmount) || orderAmount <= 0) {
    return {
      success: false,
      errors: [{ message: "Invalid customerId or orderAmount" }],
    };
  }

  const getQuery = `
    query getCustomer($id: ID!) {
      customer(id: $id) {
        creditRemaining: metafield(namespace: "custom", key: "credit_remaining") {
          value
        }
        creditUsed: metafield(namespace: "custom", key: "credit_used") {
          value
        }
      }
    }
  `;

  const getResponse = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: getQuery, variables: { id: customerId } }),
    },
  );

  const getData = await getResponse.json();
  if (getData.errors) {
    return { success: false, errors: getData.errors };
  }

  const customer = getData.data?.customer;

  // Parse money metafields (JSON string: { amount, currency_code })
  let currentRemaining = 0;
  let currentUsed = 0;

  try {
    const remainingData = JSON.parse(
      customer?.creditRemaining?.value || '{"amount":"0"}',
    );
    currentRemaining = Number.parseFloat(remainingData.amount || "0");
  } catch (e) {
    console.error("Error parsing credit_remaining:", e);
  }

  try {
    const usedData = JSON.parse(
      customer?.creditUsed?.value || '{"amount":"0"}',
    );
    currentUsed = Number.parseFloat(usedData.amount || "0");
  } catch (e) {
    console.error("Error parsing credit_used:", e);
  }

  const newRemaining = currentRemaining - orderAmount;
  const newUsed = currentUsed + orderAmount;

  console.log("=== CREDIT UPDATE ===");
  console.log("Current Remaining:", currentRemaining);
  console.log("Current Used:", currentUsed);
  console.log("Order Amount:", orderAmount);
  console.log("New Remaining:", newRemaining);
  console.log("New Used:", newUsed);

  const remainingMoneyValue = JSON.stringify({
    amount: newRemaining.toFixed(2),
    currency_code: currencyCode,
  });

  const usedMoneyValue = JSON.stringify({
    amount: newUsed.toFixed(2),
    currency_code: currencyCode,
  });

  const updateMutation = `
    mutation updateCustomerMetafields($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          creditRemaining: metafield(namespace: "custom", key: "credit_remaining") {
            value
          }
          creditUsed: metafield(namespace: "custom", key: "credit_used") {
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const updateResponse = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: updateMutation,
        variables: {
          input: {
            id: customerId,
            metafields: [
              {
                namespace: "custom",
                key: "credit_remaining",
                value: remainingMoneyValue,
                type: "money",
              },
              {
                namespace: "custom",
                key: "credit_used",
                value: usedMoneyValue,
                type: "money",
              },
            ],
          },
        },
      }),
    },
  );

  const updateData = await updateResponse.json();

  if (updateData.errors) {
    return { success: false, errors: updateData.errors };
  }

  if (updateData.data?.customerUpdate?.userErrors?.length > 0) {
    console.error("Update errors:", updateData.data.customerUpdate.userErrors);
    return {
      success: false,
      errors: updateData.data.customerUpdate.userErrors,
    };
  }

  console.log("Credit updated successfully");
  console.log("New Remaining Value:", remainingMoneyValue);
  console.log("New Used Value:", usedMoneyValue);
  return { success: true, newRemaining, newUsed };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log("Order Webhook raw body:", rawBody);

    try {
      console.log(
        "Webhook headers:",
        Object.fromEntries(req.headers.entries()),
      );
    } catch (hdrErr) {
      console.warn("Could not stringify headers:", hdrErr);
    }

    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const orderData = JSON.parse(rawBody);

    try {
      console.log("Parsed order JSON:", JSON.stringify(orderData, null, 2));
    } catch (jsonErr) {
      console.warn("Could not pretty-print parsed JSON:", jsonErr);
    }

    console.log("Order ID:", orderData.id);
    console.log("Order Number:", orderData.order_number);
    console.log("Financial Status:", orderData.financial_status);
    console.log("Customer ID:", orderData.customer?.id);
    console.log("Tags:", orderData.tags);

    // 🔍 ADDRESS DEBUGGING
    console.log("\n=== 📍 ADDRESS DATA ===");
    console.log(
      "Billing Address:",
      JSON.stringify(orderData.billing_address, null, 2),
    );
    console.log(
      "Shipping Address:",
      JSON.stringify(orderData.shipping_address, null, 2),
    );
    console.log("=== END ADDRESS ===\n");

    // Check if this is a credit-card-payment order (from Pay Order flow)
    // These orders should NOT have automatic credit deduction
    const orderTags: string[] = (orderData.tags ?? "")
      .split(",")
      .map((t: string) => t.trim());

    if (orderTags.includes("credit-card-payment")) {
      console.log(
        "✅ credit-card-payment order detected — skipping automatic credit deduction",
      );
      return NextResponse.json({
        status: "ok",
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        skipped: "credit-card-payment",
        note: "Credit card payment - manual credit management by admin",
      });
    }

    // Payment gateway bilgisini GraphQL ile çek
    let orderDetails = null;
    try {
      orderDetails = await fetchOrderPaymentGateway(
        orderData.admin_graphql_api_id,
      );
      console.log("Payment Gateway Names:", orderDetails?.paymentGatewayNames);
      console.log(
        "Customer Credit Limit:",
        orderDetails?.customer?.creditLimit?.value,
      );
      console.log(
        "Customer Credit Remaining:",
        orderDetails?.customer?.creditRemaining?.value,
      );
      console.log(
        "Customer Credit Used:",
        orderDetails?.customer?.creditUsed?.value,
      );
      console.log("Transactions:", orderDetails?.transactions);
    } catch (fetchErr) {
      console.error("Fetch order details error:", fetchErr);
    }

    // Manuel ödeme kontrolü
    const order = orderData;
    const isManualPayment =
      order.payment_gateway_names?.includes("Use My Credits");
    const isManualPaymentResolved =
      isManualPayment || orderDetails?.paymentGatewayNames?.includes("manual");

    console.log("=== PAYMENT CHECK ===");
    console.log("Is Manual Payment:", isManualPaymentResolved);
    console.log("Total Price:", orderData.total_price);
    console.log("Currency:", orderData.currency);

    let creditUpdateResult: any = null;
    if (isManualPaymentResolved) {
      console.log("🔴 MANUAL PAYMENT DETECTED - Credit should be decreased");
      console.log("Customer ID:", orderData.customer?.id);
      console.log("Amount to decrease:", orderData.total_price);

      const customerGid = orderDetails?.customer?.id;
      const amount = Number.parseFloat(String(orderData.total_price ?? "0"));
      const currencyCode = String(orderData.currency || "USD");
      creditUpdateResult = await updateCustomerCredit(
        customerGid,
        amount,
        currencyCode,
      );
      console.log("Credit update result:", creditUpdateResult);
    } else {
      console.log("✅ Other payment method - No credit decrease needed");
    }

    return NextResponse.json(
      {
        status: "ok",
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        isManualPayment: isManualPaymentResolved,
        paymentGateways: orderDetails?.paymentGatewayNames || [],
        financialStatus: orderData.financial_status,
        totalPrice: orderData.total_price,
        customerId: orderData.customer?.id,
        creditUpdateResult,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Order webhook error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
