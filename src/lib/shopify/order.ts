import { shopifyAdminFetch } from "./instance";
import { extractNumericId, toOrderGid } from "./ids";

const ORDER_MANUAL_DISCOUNT_Q = `
  query OrderManualDiscount($id: ID!) {
    order(id: $id) {
      id
      discountApplications(first: 25) {
        edges {
          node {
            __typename
            ... on ManualDiscountApplication {
              title
              description
              value {
                ... on MoneyV2 { amount currencyCode }
                ... on PricingPercentageValue { percentage }
              }
            }
          }
        }
      }
      lineItems(first: 100) {
        edges {
          node {
            sku
            quantity
            discountAllocations {
              allocatedAmountSet {
                shopMoney { amount currencyCode }
              }
              discountApplication {
                __typename
                ... on ManualDiscountApplication { title description }
              }
            }
          }
        }
      }
    }
  }
`;

const DRAFT_MANUAL_DISCOUNT_Q = `
  query DraftOrderManualDiscount($id: ID!) {
    draftOrder(id: $id) {
      id
      appliedDiscount {
        title
        description
        value
        valueType
        amount
      }
      lineItems(first: 100) {
        edges {
          node {
            sku
            quantity
            appliedDiscount {
              title
              description
              value
              valueType
            }
          }
        }
      }
    }
  }
`;

function connectionNodes(conn: any): any[] {
  if (!conn) return [];
  if (Array.isArray(conn.nodes)) return conn.nodes;
  if (Array.isArray(conn.edges)) {
    return conn.edges.map((e: any) => e?.node).filter(Boolean);
  }
  if (Array.isArray(conn)) return conn;
  return [];
}

export async function fetchShopifyOrderManualDiscount(orderId?: string | number | null) {
  const orderGid = toOrderGid(orderId);
  if (!orderGid) return null;

  try {
    const json = await shopifyAdminFetch({
      query: ORDER_MANUAL_DISCOUNT_Q,
      variables: { id: orderGid },
    });
    const order = json?.data?.order;
    if (!order) return null;
    return {
      kind: "order" as const,
      discountApplications: connectionNodes(order.discountApplications),
      lineItems: connectionNodes(order.lineItems),
    };
  } catch (err) {
    console.warn("[shopify] order manual discount fetch failed:", err);
    return null;
  }
}

export async function fetchShopifyDraftManualDiscount(draftId?: string | number | null) {
  const numeric = extractNumericId(
    typeof draftId === "number" || typeof draftId === "string" ? draftId : null,
  );
  const gid =
    String(draftId || "").includes("DraftOrder")
      ? String(draftId)
      : numeric
        ? `gid://shopify/DraftOrder/${numeric}`
        : null;
  if (!gid) return null;

  try {
    const json = await shopifyAdminFetch({
      query: DRAFT_MANUAL_DISCOUNT_Q,
      variables: { id: gid },
    });
    const draft = json?.data?.draftOrder;
    if (!draft) return null;
    return {
      kind: "draft" as const,
      appliedDiscount: draft.appliedDiscount ?? null,
      lineItems: connectionNodes(draft.lineItems),
    };
  } catch (err) {
    console.warn("[shopify] draft manual discount fetch failed:", err);
    return null;
  }
}

export async function updateOrderNote(orderId: string, note: string) {
  const mutation = `
    mutation orderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          note
          poNumber
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyAdminFetch({
    query: mutation,
    variables: { input: { id: orderId, note } },
  });

  return response.data?.orderUpdate;
}
