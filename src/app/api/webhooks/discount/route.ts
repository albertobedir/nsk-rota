/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import crypto from "crypto";

function verifyShopifyWebhook(body: string, hmac: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  return hash === hmac;
}

/**
 * Shopify Admin GraphQL API'den discount detaylarını çek
 */
async function fetchDiscountFromShopify(gid: string, webhookNode?: any) {
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN!;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;

    const query = `
      query GetDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            ... on DiscountCodeBasic {
              __typename
              title
              status
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              codes(first: 1) { nodes { code } }
              customerGets {
                value {
                  ... on DiscountAmount { amount { amount currencyCode } }
                  ... on DiscountPercentage { percentage }
                }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 10) { nodes { id } }
                  }
                  ... on DiscountCollections {
                    collections(first: 10) { nodes { id } }
                  }
                }
              }
              minimumRequirement {
                ... on DiscountMinimumSubtotal {
                  greaterThanOrEqualToSubtotal { amount }
                }
                ... on DiscountMinimumQuantity {
                  greaterThanOrEqualToQuantity
                }
              }
              customerSelection {
                ... on DiscountCustomerAll { allCustomers }
                ... on DiscountCustomers { customers { id email } }
                ... on DiscountCustomerSegments { segments { id name } }
              }
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }

            ... on DiscountCodeBxgy {
              __typename
              title
              status
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              codes(first: 1) { nodes { code } }
              customerBuys {
                value {
                  ... on DiscountQuantity { quantity }
                  ... on DiscountPurchaseAmount { amount }
                }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 10) { nodes { id } }
                  }
                  ... on DiscountCollections {
                    collections(first: 10) { nodes { id } }
                  }
                }
              }
              customerGets {
                value {
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount { amount { amount } }
                  ... on DiscountOnQuantity {
                    quantity { quantity }
                    effect {
                      ... on DiscountPercentage { percentage }
                      ... on DiscountAmount { amount { amount } }
                    }
                  }
                }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts {
                    products(first: 10) { nodes { id } }
                  }
                  ... on DiscountCollections {
                    collections(first: 10) { nodes { id } }
                  }
                }
              }
              customerSelection {
                ... on DiscountCustomerAll { allCustomers }
                ... on DiscountCustomers { customers { id email } }
                ... on DiscountCustomerSegments { segments { id name } }
              }
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }

            ... on DiscountCodeFreeShipping {
              __typename
              title
              status
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              codes(first: 1) { nodes { code } }
              minimumRequirement {
                ... on DiscountMinimumSubtotal {
                  greaterThanOrEqualToSubtotal { amount }
                }
                ... on DiscountMinimumQuantity {
                  greaterThanOrEqualToQuantity
                }
              }
              customerSelection {
                ... on DiscountCustomerAll { allCustomers }
                ... on DiscountCustomers { customers { id email } }
                ... on DiscountCustomerSegments { segments { id name } }
              }
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }
          }
        }
      }
    `;

    const res = await fetch(
      `https://${shopDomain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables: { id: gid } }),
      },
    );

    const json = await res.json();

    if (json.errors) {
      console.warn("[GRAPHQL] Errors:", json.errors);
      return null;
    }

    const discountNode = json?.data?.discountNode;
    if (!discountNode) return null;

    const discount = discountNode.discount;
    if (!discount) return null;

    const typename = discount.__typename; // "DiscountCodeBasic" | "DiscountCodeBxgy" | "DiscountCodeFreeShipping"
    const code =
      discount?.codes?.nodes?.[0]?.code ?? webhookNode?.title ?? null;

    // ===== CUSTOMER SELECTION =====
    const customerSelection = discount?.customerSelection;
    const allCustomers = customerSelection?.allCustomers ?? false;
    const specificCustomers =
      customerSelection?.customers?.map((c: any) => c.id) ?? [];
    const customerSegments =
      customerSelection?.segments?.map((s: any) => ({
        id: s.id,
        name: s.name,
      })) ?? [];

    // ===== COMBINE WITH =====
    const combinesWith = discount?.combinesWith ?? {};
    const combinesWithOrderDiscounts = combinesWith?.orderDiscounts ?? false;
    const combinesWithProductDiscounts =
      combinesWith?.productDiscounts ?? false;
    const combinesWithShippingDiscounts =
      combinesWith?.shippingDiscounts ?? false;

    // ===== MINIMUM REQUIREMENT =====
    let minimumCartAmount: number | null = null;
    let minimumQuantity: number | null = null;
    const minReq = discount?.minimumRequirement;
    if (minReq?.greaterThanOrEqualToSubtotal?.amount != null) {
      minimumCartAmount = Number(minReq.greaterThanOrEqualToSubtotal.amount);
    }
    if (minReq?.greaterThanOrEqualToQuantity != null) {
      minimumQuantity = Number(minReq.greaterThanOrEqualToQuantity);
    }

    // ===== BASE RESULT =====
    const base = {
      shopifyId: discountNode.id,
      code,
      discountType:
        typename === "DiscountCodeBasic"
          ? "BASIC"
          : typename === "DiscountCodeBxgy"
            ? "BXGY"
            : "FREE_SHIPPING",
      status: discount?.status,
      startsAt: discount?.startsAt ? new Date(discount.startsAt) : null,
      endsAt: discount?.endsAt ? new Date(discount.endsAt) : null,
      usageLimit: discount?.usageLimit ?? null,
      appliesOncePerCustomer: discount?.appliesOncePerCustomer ?? false,
      minimumCartAmount,
      minimumQuantity,
      allCustomers,
      specificCustomers,
      customerSegments,
      combinesWithOrderDiscounts,
      combinesWithProductDiscounts,
      combinesWithShippingDiscounts,
    };

    // ===== BASIC =====
    if (typename === "DiscountCodeBasic") {
      const val = discount?.customerGets?.value;
      let valueType: "PERCENTAGE" | "FIXED_AMOUNT" = "PERCENTAGE";
      let value = 0;

      if (val?.percentage != null) {
        valueType = "PERCENTAGE";
        value = Number(val.percentage) * 100;
      } else if (val?.amount?.amount != null) {
        valueType = "FIXED_AMOUNT";
        value = Number(val.amount.amount);
      }

      const items = discount?.customerGets?.items;
      return {
        ...base,
        valueType,
        value,
        appliesToAll: items?.allItems ?? false,
        appliesToProducts: items?.products?.nodes?.map((p: any) => p.id) ?? [],
        appliesToCollections:
          items?.collections?.nodes?.map((c: any) => c.id) ?? [],
        // BxGy alanları boş
        buyQuantity: null,
        buyPurchaseAmount: null,
        buyProductIds: [],
        buyCollectionIds: [],
        buyAnyProduct: false,
        getQuantity: null,
        getProductIds: [],
        getCollectionIds: [],
        getAnyProduct: false,
      };
    }

    // ===== BXGY =====
    if (typename === "DiscountCodeBxgy") {
      // Buy side
      const buyItems = discount?.customerBuys?.items;
      const buyVal = discount?.customerBuys?.value;
      const buyQuantity = buyVal?.quantity ? Number(buyVal.quantity) : null;
      const buyPurchaseAmount = buyVal?.amount ? Number(buyVal.amount) : null;
      const buyAnyProduct = buyItems?.allItems ?? false;
      const buyProductIds =
        buyItems?.products?.nodes?.map((p: any) => p.id) ?? [];
      const buyCollectionIds =
        buyItems?.collections?.nodes?.map((c: any) => c.id) ?? [];

      // Get side
      const getVal = discount?.customerGets?.value;
      const getItems = discount?.customerGets?.items;
      const getAnyProduct = getItems?.allItems ?? false;
      const getProductIds =
        getItems?.products?.nodes?.map((p: any) => p.id) ?? [];
      const getCollectionIds =
        getItems?.collections?.nodes?.map((c: any) => c.id) ?? [];

      let valueType: "PERCENTAGE" | "FIXED_AMOUNT" = "PERCENTAGE";
      let value = 0;
      let getQuantity: number | null = null;

      if (getVal?.percentage != null) {
        valueType = "PERCENTAGE";
        value = Number(getVal.percentage) * 100;
      } else if (getVal?.amount?.amount != null) {
        valueType = "FIXED_AMOUNT";
        value = Number(getVal.amount.amount);
      } else if (getVal?.quantity != null) {
        // DiscountOnQuantity
        getQuantity = getVal?.quantity?.quantity
          ? Number(getVal.quantity.quantity)
          : null;
        if (getVal.effect?.percentage != null) {
          valueType = "PERCENTAGE";
          value = Number(getVal.effect.percentage) * 100;
        } else if (getVal.effect?.amount?.amount != null) {
          valueType = "FIXED_AMOUNT";
          value = Number(getVal.effect.amount.amount);
        }
      }

      return {
        ...base,
        valueType,
        value,
        appliesToAll: false,
        appliesToProducts: [],
        appliesToCollections: [],
        buyQuantity,
        buyPurchaseAmount,
        buyProductIds,
        buyCollectionIds,
        buyAnyProduct,
        getQuantity,
        getProductIds,
        getCollectionIds,
        getAnyProduct,
      };
    }

    // ===== FREE SHIPPING =====
    return {
      ...base,
      valueType: "PERCENTAGE" as const,
      value: 100,
      appliesToAll: true,
      appliesToProducts: [],
      appliesToCollections: [],
      buyQuantity: null,
      buyPurchaseAmount: null,
      buyProductIds: [],
      buyCollectionIds: [],
      buyAnyProduct: false,
      getQuantity: null,
      getProductIds: [],
      getCollectionIds: [],
      getAnyProduct: false,
    };
  } catch (error) {
    console.error("[GRAPHQL] Error fetching discount:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get("x-shopify-hmac-sha256") ?? "";

    // Webhook imzasını doğrula
    if (!verifyShopifyWebhook(rawBody, hmac)) {
      console.warn("[WEBHOOK DISCOUNT] Unauthorized - invalid HMAC");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic");
    const data = JSON.parse(rawBody);

    console.log(
      `[WEBHOOK DISCOUNT] topic=${topic}`,
      JSON.stringify(data, null, 2),
    );

    // CREATE veya UPDATE işlemleri
    if (topic === "discounts/create" || topic === "discounts/update") {
      const node = data;

      // DEBUG: Webhook payload'ını logla
      console.log(
        "[WEBHOOK DISCOUNT] RAW webhook payload:",
        JSON.stringify(node, null, 2),
      );

      // admin_graphql_api_id'yı kontrol et
      const adminGraphqlId = node.admin_graphql_api_id;
      if (!adminGraphqlId) {
        console.warn(
          "[WEBHOOK DISCOUNT] No admin_graphql_api_id in payload, skipping",
        );
        return NextResponse.json({ ok: true });
      }

      // GraphQL API'den tam detayı çek
      const discountDetail = await fetchDiscountFromShopify(
        adminGraphqlId,
        node,
      );

      if (!discountDetail) {
        console.warn(
          "[WEBHOOK DISCOUNT] Could not fetch discount detail from GraphQL",
        );
        return NextResponse.json({ ok: true });
      }

      const {
        code,
        discountType,
        valueType,
        value,
        status,
        startsAt,
        endsAt,
        usageLimit,
        shopifyId,
        appliesOncePerCustomer,
        minimumCartAmount,
        minimumQuantity,
        allCustomers,
        specificCustomers,
        customerSegments,
        appliesToAll,
        appliesToProducts,
        appliesToCollections,
        buyQuantity,
        buyPurchaseAmount,
        buyProductIds,
        buyCollectionIds,
        buyAnyProduct,
        getQuantity,
        getProductIds,
        getCollectionIds,
        getAnyProduct,
        combinesWithOrderDiscounts,
        combinesWithProductDiscounts,
        combinesWithShippingDiscounts,
      } = discountDetail;

      if (!code) {
        console.warn("[WEBHOOK DISCOUNT] No code in discount detail");
        return NextResponse.json({ ok: true });
      }

      const active = status === "ACTIVE";

      // DB'ye upsert et
      const created = await prisma.discountCode.upsert({
        where: { code: code.toUpperCase() },
        update: {
          shopifyId,
          discountType,
          valueType,
          value,
          usageLimit,
          startsAt,
          endsAt,
          active,
          appliesOncePerCustomer,
          minimumCartAmount,
          minimumQuantity,
          allCustomers,
          specificCustomers,
          customerSegments,
          appliesToAll,
          appliesToProducts,
          appliesToCollections,
          buyQuantity,
          buyPurchaseAmount,
          buyProductIds,
          buyCollectionIds,
          buyAnyProduct,
          getQuantity,
          getProductIds,
          getCollectionIds,
          getAnyProduct,
          combinesWithOrderDiscounts,
          combinesWithProductDiscounts,
          combinesWithShippingDiscounts,
          updatedAt: new Date(),
        },
        create: {
          code: code.toUpperCase(),
          shopifyId,
          discountType,
          valueType,
          value,
          usageLimit,
          startsAt,
          endsAt,
          active,
          appliesOncePerCustomer,
          minimumCartAmount,
          minimumQuantity,
          allCustomers,
          specificCustomers,
          customerSegments,
          appliesToAll,
          appliesToProducts,
          appliesToCollections,
          buyQuantity,
          buyPurchaseAmount,
          buyProductIds,
          buyCollectionIds,
          buyAnyProduct,
          getQuantity,
          getProductIds,
          getCollectionIds,
          getAnyProduct,
          combinesWithOrderDiscounts,
          combinesWithProductDiscounts,
          combinesWithShippingDiscounts,
        },
      });

      console.log(
        `[WEBHOOK DISCOUNT] ${topic === "discounts/create" ? "CREATED" : "UPDATED"} code=${code}`,
        JSON.stringify(created, null, 2),
      );

      return NextResponse.json({ ok: true });
    }

    // DELETE operation
    if (topic === "discounts/delete") {
      const adminGraphqlId = data.admin_graphql_api_id;
      const code = data.title || data.code; // Code from webhook payload

      const whereClause: any = adminGraphqlId
        ? { shopifyId: adminGraphqlId }
        : code
          ? { code: code.toUpperCase() }
          : null;

      if (!whereClause) {
        console.warn(
          "[WEBHOOK DISCOUNT DELETE] No identifier (shopifyId or code) found, skipping",
        );
        return NextResponse.json({ ok: true });
      }

      // Hard delete from database
      const deleted = await prisma.discountCode.deleteMany({
        where: whereClause,
      });

      console.log(
        `[WEBHOOK DISCOUNT DELETE] Deleted ${deleted.count} discount record(s) - ${adminGraphqlId || code}`,
      );

      return NextResponse.json({ ok: true });
    }

    console.log(`[WEBHOOK DISCOUNT] Unknown topic: ${topic}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WEBHOOK DISCOUNT] Error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
