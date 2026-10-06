/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose/instance";
import prisma from "@/lib/prisma/instance";
import { extractNumericId, toCustomerGid, toOrderGid } from "@/lib/shopify/ids";
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
        creditRestoreEligible: !isPaidFinancialStatus(params.financialStatus),
        creditRestored: false,
        creditRestoredAt: null,
      },
    },
  );
}

async function unclaimCreditRestore(orderId: Types.ObjectId) {
  await Order.updateOne(
    { _id: orderId, creditRestored: true },
    {
      $set: { creditRestored: false },
      $unset: { creditRestoredAt: 1 },
    },
  );
}

async function findOrderForCreditRestore(shopifyId: string, orderData?: any) {
  const numericId =
    extractNumericId(shopifyId) ||
    (orderData?.id != null ? String(orderData.id) : null);
  const orderNumber = orderData?.order_number
    ? Number(orderData.order_number)
    : orderData?.name
      ? Number(String(orderData.name).replace(/^#/, ""))
      : undefined;

  return Order.findOne({
    $or: [
      { shopifyId },
      ...(numericId
        ? [
            { shopifyId: numericId },
            { shopifyId: `gid://shopify/Order/${numericId}` },
            { "raw.id": Number(numericId) },
            { "raw.id": numericId },
          ]
        : []),
      ...(orderNumber && !Number.isNaN(orderNumber) ? [{ orderNumber }] : []),
    ],
  });
}

function creditRestoreSkip(
  reason: string,
  details: Record<string, unknown>,
) {
  console.log(`[credit-restore] bakiye geri yazilmadi | reason=${reason}`, details);
  return { restored: false, reason, ...details };
}

async function syncPrismaCreditBalances(params: {
  customerId: string;
  creditRemaining: number;
  creditUsed: number;
}) {
  const gid = toCustomerGid(params.customerId);
  const numeric = extractNumericId(params.customerId);
  const ids = Array.from(
    new Set([gid, numeric].filter((value): value is string => Boolean(value))),
  );
  if (!ids.length) return { users: 0, customers: 0 };

  const data = {
    creditRemaining: params.creditRemaining.toFixed(2),
    creditUsed: params.creditUsed.toFixed(2),
  };

  const [users, customers] = await Promise.all([
    prisma.user.updateMany({
      where: { shopifyCustomerId: { in: ids } },
      data,
    }),
    prisma.customer.updateMany({
      where: { shopifyId: { in: ids } },
      data,
    }),
  ]);

  return { users: users.count, customers: customers.count };
}

export async function maybeRestoreCreditWhenPaid(params: {
  shopifyId: string;
  orderData: any;
  previousFinancialStatus?: string | null;
}) {
  const { shopifyId, orderData, previousFinancialStatus } = params;
  const currentFinancialStatus = orderData?.financial_status;

  const paymentGateways = [
    ...(Array.isArray(orderData?.payment_gateway_names)
      ? orderData.payment_gateway_names
      : []),
  ];

  if (!isPaidFinancialStatus(currentFinancialStatus)) {
    return creditRestoreSkip("not_paid", {
      shopifyId,
      order: orderData?.name ?? null,
      currentFinancialStatus: currentFinancialStatus ?? null,
      previousFinancialStatus: previousFinancialStatus ?? null,
      paymentGateways,
    });
  }

  await connectDB();
  const existing = await findOrderForCreditRestore(shopifyId, orderData);

  let orderDetails: OrderPaymentDetails | null = null;
  try {
    orderDetails = await fetchOrderPaymentDetails(shopifyId);
  } catch (err) {
    console.error("[credit-restore] Failed to fetch order payment details:", err);
  }

  const transactionGateways = (orderDetails?.transactions ?? [])
    .map((transaction) => transaction.gateway)
    .filter((gateway): gateway is string => Boolean(gateway));
  paymentGateways.push(...(orderDetails?.paymentGatewayNames ?? []), ...transactionGateways);
  const paidWithUseMyCreditResolved = orderUsesMyCredits(paymentGateways);

  const deductedAmount = Number(existing?.creditDeductedAmount);
  const previousWasAlreadyPaid = isPaidFinancialStatus(previousFinancialStatus);
  const heldUntilPayment =
    Boolean(existing?.creditRestoreEligible) ||
    isOpenFinancialStatus(previousFinancialStatus) ||
    (paidWithUseMyCreditResolved && !previousWasAlreadyPaid);
  const snapshot = {
    shopifyId,
    order: orderData?.name ?? existing?.name ?? null,
    currentFinancialStatus,
    previousFinancialStatus: previousFinancialStatus ?? null,
    paymentGateways,
    paidWithUseMyCredit: paidWithUseMyCreditResolved,
    creditDeducted: Boolean(existing?.creditDeducted),
    creditRestoreEligible: Boolean(existing?.creditRestoreEligible),
    creditRestored: Boolean(existing?.creditRestored),
    creditDeductedAmount: Number.isFinite(deductedAmount) ? deductedAmount : null,
  };

  if (!existing) {
    return creditRestoreSkip("order_not_in_mongo", snapshot);
  }
  if (!existing.creditDeducted || !Number.isFinite(deductedAmount) || deductedAmount <= 0) {
    return creditRestoreSkip("credit_not_deducted", snapshot);
  }
  if (existing.creditRestored) {
    return creditRestoreSkip("already_restored", snapshot);
  }
  if (!heldUntilPayment) {
    return creditRestoreSkip("not_a_credit_hold", snapshot);
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: existing._id,
      creditDeducted: true,
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
    return creditRestoreSkip("already_claimed", snapshot);
  }

  const customerId =
    claimed.customerId ||
    orderDetails?.customer?.id ||
    toCustomerGid(orderData?.customer?.id);

  const amount = Number(claimed.creditDeductedAmount);
  const currencyCode = String(
    claimed.creditCurrency || orderData?.currency || "USD",
  );

  if (!customerId || !Number.isFinite(amount) || amount <= 0) {
    console.error("[credit-restore] Missing customer or deducted amount", {
      shopifyId,
      customerId,
      amount,
      previousFinancialStatus,
    });
    await unclaimCreditRestore(claimed._id);
    return { restored: false, reason: "missing_customer_or_amount" };
  }

  console.log("[credit-restore] admin paid — restoring deducted credit", {
    shopifyId,
    order: orderData?.name ?? null,
    customerId,
    amount,
    currencyCode,
    previousFinancialStatus,
    paymentGateways,
  });

  const result = await updateCustomerCredit(
    customerId,
    amount,
    currencyCode,
    "restore",
  );

  const restoredRemaining = result.newRemaining;
  const restoredUsed = result.newUsed;
  if (
    !result.success ||
    restoredRemaining == null ||
    restoredUsed == null
  ) {
    console.error("[credit-restore] Shopify credit restore failed:", result);
    await unclaimCreditRestore(claimed._id);
    return { restored: false, reason: "shopify_update_failed", result };
  }

  let prismaSync: { users: number; customers: number } | null = null;
  try {
    prismaSync = await syncPrismaCreditBalances({
      customerId,
      creditRemaining: restoredRemaining,
      creditUsed: restoredUsed,
    });
    console.log("[credit-restore] Prisma balances synced", prismaSync);
  } catch (err) {
    console.error(
      "[credit-restore] Shopify metafield restored, Prisma sync failed:",
      err,
    );
  }

  console.log(
    `ADMIN TARAFINDAN BAKIYE GERI YUKLENDI | order=${orderData?.name ?? shopifyId} | amount=${amount} ${currencyCode} | customer=${customerId} | kalan=${restoredRemaining} | kullanilan=${restoredUsed}`,
  );

  return { restored: true, result, prismaSync };
}
