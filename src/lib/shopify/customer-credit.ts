/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import { toCustomerGid, toOrderGid } from "@/lib/shopify/ids";
import Order from "@/schemas/mongoose/order";

type CreditMode = "deduct" | "restore";

export type OrderPaymentDetails = {
  paymentGatewayNames?: string[];
  paymentCollectionDetails?: {
    additionalPaymentCollectionUrl?: string | null;
  };
  customer?: {
    id?: string;
    creditLimit?: { value?: string } | null;
    creditRemaining?: { value?: string } | null;
    creditUsed?: { value?: string } | null;
  };
  transactions?: Array<{
    gateway?: string | null;
    kind?: string | null;
    status?: string | null;
    processedAt?: string | null;
  }>;
};

export function parseMoneyMetafield(value?: string | null): number {
  try {
    const remainingData = JSON.parse(value || '{"amount":"0"}');
    return Number.parseFloat(remainingData.amount || "0");
  } catch (e) {
    console.error("Error parsing credit money metafield:", e);
    return 0;
  }
}

export function isUseMyCreditsGateway(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  return (
    normalized === "manual" ||
    normalized === "use my credits" ||
    normalized.includes("use my credit")
  );
}

export function orderUsesMyCredits(
  restGatewayNames?: string[] | null,
  graphqlGatewayNames?: string[] | null,
): boolean {
  return [...(restGatewayNames ?? []), ...(graphqlGatewayNames ?? [])].some(
    isUseMyCreditsGateway,
  );
}

export function isOpenFinancialStatus(status?: string | null): boolean {
  const normalized = String(status || "").toLowerCase();
  return ["pending", "authorized", "partially_paid", "unpaid"].includes(
    normalized,
  );
}

export function isPaidFinancialStatus(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "paid";
}

async function shopifyAdminGraphql<T = any>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopifyDomain || !accessToken) {
    console.error("Missing Shopify config for credit update");
    return null;
  }

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const data = await response.json();
  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    return null;
  }

  return data;
}

export async function fetchOrderPaymentDetails(
  orderId?: string | null,
): Promise<OrderPaymentDetails | null> {
  const id = toOrderGid(orderId);
  if (!id) return null;

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
          processedAt
        }
      }
    }
  `;

  const data = await shopifyAdminGraphql<{ data?: { order?: OrderPaymentDetails } }>(
    query,
    { id },
  );

  return data?.data?.order || null;
}

export async function updateCustomerCredit(
  customerId: string | null | undefined,
  orderAmount: number,
  currencyCode: string,
  mode: CreditMode = "deduct",
) {
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

  const getData = await shopifyAdminGraphql<{
    data?: {
      customer?: {
        creditRemaining?: { value?: string };
        creditUsed?: { value?: string };
      };
    };
    errors?: unknown;
  }>(getQuery, { id: customerId });

  if (!getData || getData.errors) {
    return { success: false, errors: getData?.errors || [{ message: "Fetch failed" }] };
  }

  const customer = getData.data?.customer;
  const currentRemaining = parseMoneyMetafield(customer?.creditRemaining?.value);
  const currentUsed = parseMoneyMetafield(customer?.creditUsed?.value);

  const newRemaining =
    mode === "deduct"
      ? currentRemaining - orderAmount
      : currentRemaining + orderAmount;
  const newUsed =
    mode === "deduct"
      ? currentUsed + orderAmount
      : Math.max(0, currentUsed - orderAmount);

  console.log("=== CREDIT UPDATE ===");
  console.log("Mode:", mode);
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

  const updateData = await shopifyAdminGraphql<{
    errors?: unknown;
    data?: {
      customerUpdate?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  }>(updateMutation, {
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
  });

  if (!updateData || updateData.errors) {
    return { success: false, errors: updateData?.errors || [{ message: "Update failed" }] };
  }

  if (updateData.data?.customerUpdate?.userErrors?.length) {
    console.error("Update errors:", updateData.data.customerUpdate.userErrors);
    return {
      success: false,
      errors: updateData.data.customerUpdate.userErrors,
    };
  }

  console.log("Credit updated successfully");
  console.log("New Remaining Value:", remainingMoneyValue);
  console.log("New Used Value:", usedMoneyValue);
  return { success: true, newRemaining, newUsed, mode };
}

export async function markOrderCreditDeducted(params: {
  shopifyId: string;
  amount: number;
  currencyCode: string;
  financialStatus?: string | null;
}) {
  await connectDB();
  await Order.updateOne(
    { shopifyId: params.shopifyId },
    {
      $set: {
        creditDeducted: true,
        creditDeductedAmount: params.amount,
        creditCurrency: params.currencyCode,
        creditDeductedAt: new Date(),
        creditRestoreEligible: isOpenFinancialStatus(params.financialStatus),
        creditRestored: false,
        creditRestoredAt: null,
      },
    },
  );
}

async function unclaimCreditRestore(shopifyId: string) {
  await Order.updateOne(
    { shopifyId, creditRestored: true },
    {
      $set: { creditRestored: false },
      $unset: { creditRestoredAt: 1 },
    },
  );
}

export async function maybeRestoreCreditWhenPaid(params: {
  shopifyId: string;
  orderData: any;
  previousFinancialStatus?: string | null;
}) {
  const { shopifyId, orderData, previousFinancialStatus } = params;
  const currentFinancialStatus = orderData?.financial_status;

  if (
    !isPaidFinancialStatus(currentFinancialStatus) ||
    !isOpenFinancialStatus(previousFinancialStatus)
  ) {
    return { restored: false, reason: "not_pending_to_paid" };
  }

  await connectDB();
  const existing = await Order.findOne({ shopifyId });
  if (!existing || existing.creditRestored) {
    return { restored: false, reason: "not_eligible" };
  }

  const createdWithCredits = orderUsesMyCredits(
    Array.isArray((existing.raw as any)?.payment_gateway_names)
      ? ((existing.raw as any).payment_gateway_names as string[])
      : null,
  );
  const flaggedEligible =
    Boolean(existing.creditDeducted) && Boolean(existing.creditRestoreEligible);
  const legacyEligible = !existing.creditDeducted && createdWithCredits;

  if (!flaggedEligible && !legacyEligible) {
    return { restored: false, reason: "not_eligible" };
  }

  const claimed = await Order.findOneAndUpdate(
    {
      shopifyId,
      creditRestored: { $ne: true },
    },
    {
      $set: {
        creditRestored: true,
        creditRestoredAt: new Date(),
      },
    },
    { new: false },
  );

  if (!claimed) {
    return { restored: false, reason: "already_claimed" };
  }

  let orderDetails: OrderPaymentDetails | null = null;
  try {
    orderDetails = await fetchOrderPaymentDetails(shopifyId);
  } catch (err) {
    console.error("[credit-restore] Failed to fetch order payment details:", err);
  }

  const customerId =
    claimed.customerId ||
    orderDetails?.customer?.id ||
    toCustomerGid(orderData?.customer?.id);

  const amount = Number(
    claimed.creditDeductedAmount || orderData?.total_price || 0,
  );
  const currencyCode = String(
    claimed.creditCurrency || orderData?.currency || "USD",
  );

  if (!customerId || amount <= 0) {
    console.error("[credit-restore] Missing customer or amount", {
      shopifyId,
      customerId,
      amount,
    });
    await unclaimCreditRestore(shopifyId);
    return { restored: false, reason: "missing_customer_or_amount" };
  }

  console.log("🟢 INVOICE PAID — restoring previously deducted credit", {
    shopifyId,
    customerId,
    amount,
    currencyCode,
    paymentGateways: orderData?.payment_gateway_names,
  });

  const result = await updateCustomerCredit(
    customerId,
    amount,
    currencyCode,
    "restore",
  );

  if (!result.success) {
    console.error("[credit-restore] Shopify credit restore failed:", result);
    await unclaimCreditRestore(shopifyId);
    return { restored: false, reason: "shopify_update_failed", result };
  }

  return { restored: true, result };
}
