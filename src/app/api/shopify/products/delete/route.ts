/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VERSION = "2024-10";

// ✅ GraphQL helper
async function shopifyGraphQL(query: string, variables?: any) {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  return res.json();
}

// ✅ RotaNo (SKU) ile product ID bul
async function findProductIdByRotaNo(rotaNo: string) {
  const query = `
    query findBySku($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            product {
              id
              title
            }
          }
        }
      }
    }
  `;

  const res = await shopifyGraphQL(query, { query: `sku:${rotaNo}` });
  const edge = res.data?.productVariants?.edges?.[0]?.node;

  if (!edge) throw new Error(`RotaNo ${rotaNo} ile ürün bulunamadı`);

  return {
    productId: edge.product.id,
    title: edge.product.title,
  };
}

// ✅ DELETE handler
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();

    const rotaNo = body.RotaNo;
    if (!rotaNo) {
      return NextResponse.json(
        { ok: false, error: "RotaNo zorunlu" },
        { status: 400 },
      );
    }

    // 1. Ürünü bul
    const { productId, title } = await findProductIdByRotaNo(rotaNo);

    // 2. Sil
    const mutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const res = await shopifyGraphQL(mutation, {
      input: { id: productId },
    });

    const errors = res.data?.productDelete?.userErrors || [];
    if (errors.length > 0) throw new Error(JSON.stringify(errors));

    const deletedId = res.data?.productDelete?.deletedProductId;

    return NextResponse.json({
      ok: true,
      deletedProductId: deletedId,
      rotaNo,
      title,
    });
  } catch (err: any) {
    console.error("❌ Product delete error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
