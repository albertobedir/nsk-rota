/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function createVerifiedTransporter() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || "",
    },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    requireTLS: true,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  try {
    await transporter.verify();
    console.log("[✅ SMTP Connection] Verified successfully");
  } catch (err) {
    console.error("[❌ SMTP Connection] Failed:", err);
  }

  return transporter;
}

async function sendEmailSafely(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
) {
  return new Promise<string>((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) reject(err);
      else resolve(info?.messageId || "unknown");
    });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function cancelShopifyOrder(orderGid: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const mutation = `
    mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $restock: Boolean!, $notifyCustomer: Boolean!) {
      orderCancel(orderId: $orderId, reason: $reason, restock: $restock, notifyCustomer: $notifyCustomer) {
        orderCancelUserErrors { message }
      }
    }
  `;

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken!,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          orderId: orderGid,
          reason: "OTHER",
          restock: true,
          notifyCustomer: false,
        },
      }),
    },
  );

  const data = await response.json();
  console.log("Cancel order result:", JSON.stringify(data, null, 2));
  return data;
}

async function sendInsufficientCreditEmail({
  email,
  firstName,
  orderName,
  orderAmount,
  creditRemaining,
  currencyCode,
}: {
  email: string;
  firstName?: string;
  orderName: string;
  orderAmount: number;
  creditRemaining: number;
  currencyCode: string;
}) {
  const transporter = await createVerifiedTransporter();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background:#f3f4f6; padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(15,23,42,0.06);">
        
        <!-- Header with Rota USA branding -->
        <div style="background:#0a66c2; padding:20px; display:flex; align-items:center; gap:12px;">
          <svg style="width:40px; height:40px;" viewBox="0 0 40 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.332 4.9671C21.7482 4.88166 21.1501 4.81758 20.552 4.78909V3.15143H22.4531V1.61344C22.4541 1.51646 22.4242 1.42167 22.3676 1.34287C22.0272 0.916401 21.5933 0.573891 21.0995 0.341787C20.6057 0.109683 20.0651 -0.00579741 19.5195 0.00426459C18.9607 -0.0235572 18.4036 0.0850703 17.8962 0.320775C17.3888 0.556479 16.9465 0.912169 16.6073 1.35711C16.5583 1.43081 16.5335 1.51789 16.5361 1.60633V3.16566H18.5155V4.80333C17.9388 4.80333 17.3763 4.88878 16.8138 4.9671C12.0837 5.59777 7.75267 7.95193 4.65092 11.5784C1.54918 15.2048 -0.105092 19.8484 0.00517797 24.6191C0.115448 29.3899 1.9825 33.9521 5.24849 37.4313C8.51447 40.9106 12.9496 43.0621 17.7038 43.4736V41.9427C8.44747 41.0456 1.16342 33.3984 1.16342 24.142C1.16342 14.2804 9.38735 6.27723 19.5337 6.27723C29.018 6.27723 36.8147 13.2693 37.7973 22.2409H38.9935C38.5455 17.914 36.6613 13.8619 33.6414 10.731C30.6215 7.60007 26.6399 5.57086 22.332 4.9671Z" fill="white"/>
          </svg>
          <div style="color:#fff; font-weight:700; font-size:16px;">Rota USA</div>
        </div>

        <!-- Content -->
        <div style="padding:24px; color:#1f2937;">
          <h2 style="color:#dc2626; margin:0 0 12px; font-size:20px; font-weight:700;">Order Cancelled</h2>
          
          <p style="margin:0 0 16px 0; line-height:1.6; color:#374151;">
            Hello <strong>${escapeHtml(firstName || "Valued Customer")}</strong>,
          </p>

          <p style="margin:0 0 16px 0; line-height:1.6; color:#374151;">
            Your order <strong>${escapeHtml(orderName)}</strong> could not be completed because your available credit is insufficient.
          </p>

          <!-- Order Details Table -->
          <table style="width:100%; border-collapse:collapse; margin:24px 0;">
            <tr>
              <td style="padding:12px 0; font-weight:600; color:#111827; border-bottom:1px solid #e5e7eb;">Order Total</td>
              <td style="padding:12px 0; color:#374151; border-bottom:1px solid #e5e7eb; text-align:right;">$${orderAmount.toFixed(2)} ${currencyCode}</td>
            </tr>
            <tr>
              <td style="padding:12px 0; font-weight:600; color:#111827; border-bottom:1px solid #e5e7eb;">Available Credit</td>
              <td style="padding:12px 0; color:#dc2626; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">$${creditRemaining.toFixed(2)} ${currencyCode}</td>
            </tr>
            <tr>
              <td style="padding:12px 0; font-weight:600; color:#111827;">Shortfall</td>
              <td style="padding:12px 0; color:#dc2626; text-align:right; font-weight:600;">$${(orderAmount - creditRemaining).toFixed(2)} ${currencyCode}</td>
            </tr>
          </table>

          <p style="margin:16px 0 0 0; line-height:1.6; color:#374151;">
            To complete your purchase, you can:
          </p>
          <ul style="margin:12px 0 0 20px; color:#374151; line-height:1.8;">
            <li>Use a credit card at checkout</li>
            <li>Contact us to increase your credit limit</li>
          </ul>

          <!-- Footer text -->
          <p style="font-size:13px; color:#6b7280; margin-top:24px;">This email was sent automatically. For questions, please contact our team.</p>
        </div>

        <!-- Footer -->
        <div style="background:#f7fafc; padding:12px 18px; font-size:12px; color:#6b7280; text-align:center; border-top:1px solid #e5e7eb;">
          Rota USA • <a href="https://rota-usa.com" style="color:#0a66c2; text-decoration:none;">rota-usa.com</a>
        </div>
      </div>
    </div>
  `;

  await sendEmailSafely(transporter, {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `Order ${orderName} — Unable to Complete`,
    html,
  });

  console.log(`[✅ Insufficient Credit Email] Sent to: ${email}`);
}

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
        paymentCollectionDetails {
          additionalPaymentCollectionUrl
        }
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

    // Guard against fulfillment events being sent to orders/create
    if (
      orderData.admin_graphql_api_id?.includes("Fulfillment") ||
      orderData.kind === "fulfillment"
    ) {
      console.log("⚠️ Fulfillment payload — skipping orders/create handler");
      return NextResponse.json({ status: "ok", skipped: "fulfillment" });
    }

    try {
      console.log("Parsed order JSON:", JSON.stringify(orderData, null, 2));
    } catch (jsonErr) {
      console.warn("Could not pretty-print parsed JSON:", jsonErr);
    }

    // Declare orderDetails outside try/catch so it's accessible throughout the handler
    let orderDetails: any = null;

    // 💾 MongoDB'ye kaydet
    try {
      await connectDB();

      const shopifyId = orderData.admin_graphql_api_id
        ? String(orderData.admin_graphql_api_id).split("?")[0]
        : `gid://shopify/Order/${orderData.id}`;

      const orderNumber = orderData.order_number
        ? Number(orderData.order_number)
        : orderData.name
          ? Number(String(orderData.name).replace(/^#/, ""))
          : undefined;

      // null field'ları strip et
      function stripNulls(obj: Record<string, any> | null | undefined) {
        if (!obj) return undefined;
        return Object.fromEntries(
          Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
        );
      }

      const billingAddress = stripNulls(orderData.billing_address);
      const shippingAddress = stripNulls(orderData.shipping_address);

      // raw içinden customer id'yi çıkar
      const customerGid = orderData.customer?.id
        ? `gid://shopify/Customer/${orderData.customer.id}`
        : undefined;

      // Payment gateway bilgisini GraphQL ile çek (MongoDB'ye kaydetmeden önce)
      try {
        orderDetails = await fetchOrderPaymentGateway(
          orderData.admin_graphql_api_id,
        );
      } catch (fetchErr) {
        console.error("Fetch order details error:", fetchErr);
      }

      await Order.findOneAndUpdate(
        { shopifyId },
        {
          $set: {
            shopifyId,
            orderNumber,
            name: orderData.name ?? undefined,
            customerId: customerGid,
            paymentCollectionUrl:
              orderDetails?.paymentCollectionDetails
                ?.additionalPaymentCollectionUrl ?? undefined,
            ...(billingAddress && { billingAddress }),
            ...(shippingAddress && { shippingAddress }),
            raw: orderData,
          },
        },
        { upsert: true, new: true },
      );

      console.log("✅ Order saved to MongoDB:", shopifyId);
    } catch (dbErr) {
      // DB hatası webhook'u bloklamamalı
      console.error("❌ MongoDB upsert error:", dbErr);
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

    // Log payment details (orderDetails already fetched before MongoDB save)
    if (orderDetails) {
      console.log("Payment Gateway Names:", orderDetails.paymentGatewayNames);
      console.log(
        "Customer Credit Limit:",
        orderDetails.customer?.creditLimit?.value,
      );
      console.log(
        "Customer Credit Remaining:",
        orderDetails.customer?.creditRemaining?.value,
      );
      console.log(
        "Customer Credit Used:",
        orderDetails.customer?.creditUsed?.value,
      );
      console.log("Transactions:", orderDetails.transactions);
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

      // ✅ NEW: Kredi yeterlilik kontrolü
      let currentRemaining = 0;
      try {
        const remainingData = JSON.parse(
          orderDetails?.customer?.creditRemaining?.value || '{"amount":"0"}',
        );
        currentRemaining = Number.parseFloat(remainingData.amount || "0");
      } catch (e) {
        console.error("Error parsing credit_remaining for check:", e);
      }

      if (currentRemaining < amount) {
        console.log(
          "❌ Insufficient credit — cancelling order. Current:",
          currentRemaining,
          "Needed:",
          amount,
        );

        // 1. Siparişi iptal et
        try {
          await cancelShopifyOrder(orderData.admin_graphql_api_id);
        } catch (cancelErr) {
          console.error("Error cancelling Shopify order:", cancelErr);
        }

        // 2. Mail at
        try {
          await sendInsufficientCreditEmail({
            email: orderData.email,
            firstName: orderData.customer?.first_name,
            orderName: orderData.name,
            orderAmount: amount,
            creditRemaining: currentRemaining,
            currencyCode,
          });
        } catch (emailErr) {
          console.error("Error sending insufficient credit email:", emailErr);
        }

        return NextResponse.json({
          status: "ok",
          orderId: orderData.id,
          orderNumber: orderData.order_number,
          skipped: "insufficient_credit",
          note: "Order cancelled due to insufficient credit",
        });
      }

      // Kredi yeterliyse düş
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
