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

// ✅ REST helper
async function shopifyREST(path: string, method = "GET", body?: any) {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  return res.json();
}

// ✅ RotaNo (SKU) ile ürünü bul → productId + variantId + inventoryItemId döner
async function findProductByRotaNo(rotaNo: string) {
  const query = `
    query findBySku($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            id
            inventoryItem {
              id
            }
            product {
              id
              media(first: 20) {
                edges {
                  node {
                    id
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
                }
              }
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
    variantGid: edge.id,
    variantId: edge.id.split("/").pop(),
    inventoryItemId: edge.inventoryItem.id.split("/").pop(),
    existingMediaIds: edge.product.media.edges.map((e: any) => e.node.id),
  };
}

// ✅ Location ID çek
async function getLocationId() {
  const res = await shopifyREST("/locations.json");
  return res.locations?.[0]?.id || null;
}

// ✅ Mevcut medyaları sil
async function deleteProductMedia(productId: string, mediaIds: string[]) {
  if (mediaIds.length === 0) return;

  const mutation = `
    mutation deleteMedia($productId: ID!, $mediaIds: [ID!]!) {
      productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
        deletedMediaIds
        userErrors {
          field
          message
        }
      }
    }
  `;

  await shopifyGraphQL(mutation, { productId, mediaIds });
}

// ✅ Yeni medya ekle
async function addProductMedia(
  productId: string,
  photos: string[],
  productName: string,
) {
  if (photos.length === 0) return;

  const sortedPhotos = [...photos].sort((a, b) => {
    const aIsMain = /products\/\d{5,}/.test(a);
    const bIsMain = /products\/\d{5,}/.test(b);
    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;
    return 0;
  });

  const mutation = `
    mutation createMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  await shopifyGraphQL(mutation, {
    productId,
    media: sortedPhotos.map((url, index) => ({
      originalSource: url,
      alt: `${productName} - Image ${index + 1}`,
      mediaContentType: "IMAGE",
    })),
  });
}

// ✅ Product update (title, description, tags, vendor, productType, metafields)
async function updateProductCore(productId: string, product: any) {
  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const vendor = product.Brands?.[0]?.BrandDescription || "";
  const productType = product.Brands?.[0]?.BrandClass || "";

  const tags = [
    productType,
    ...(product.Brands?.map((b: any) => b.BrandDescription) || []),
    ...(product.Oems?.map((oem: any) => oem.MarkaDescription) || []),
    ...(product.Competiters?.map((c: any) => c.CompetitorName) || []),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  // Tüm metafield'ları gönder — boş array olsa bile (temizlemek için "[]" string)
  const metafields = [
    {
      namespace: "custom",
      key: "oem_info",
      type: "json",
      value: JSON.stringify(product.Oems ?? []),
    },
    {
      namespace: "custom",
      key: "technical_info",
      type: "json",
      value: JSON.stringify(product.Details ?? []),
    },
    {
      namespace: "custom",
      key: "competitor_info",
      type: "json",
      value: JSON.stringify(product.Competiters ?? []),
    },
    {
      namespace: "custom",
      key: "comp",
      type: "json",
      value: JSON.stringify(product.Components ?? []),
    },
    {
      namespace: "custom",
      key: "applications",
      type: "json",
      value: JSON.stringify(product.Applications ?? []),
    },
    {
      namespace: "custom",
      key: "pairings",
      type: "json",
      value: JSON.stringify(product.Pairings ?? []),
    },
    {
      namespace: "custom",
      key: "brand_info",
      type: "json",
      value: JSON.stringify(product.Brands ?? []),
    },
  ];

  const res = await shopifyGraphQL(mutation, {
    input: {
      id: productId,
      title: `${product.ProductEn} - ${product.RotaNo}`,
      descriptionHtml: `<p>${product.ProductEn}</p>`,
      vendor,
      productType,
      tags,
      metafields,
    },
  });

  const errors = res.data?.productUpdate?.userErrors || [];
  if (errors.length > 0) throw new Error(JSON.stringify(errors));

  return res.data?.productUpdate?.product?.handle;
}

// ✅ Variant güncelle (fiyat, SKU, ağırlık)
async function updateVariant(
  variantId: string,
  inventoryItemId: string,
  product: any,
  locationId: number,
) {
  const parsedPrice = product.Price
    ? parseFloat(product.Price.replace(",", ".")).toFixed(2)
    : "0.00";

  let weightValue = 0;
  if (product.Weight?.lb) {
    const match = product.Weight.lb.match(/[\d,\.]+/);
    if (match) weightValue = parseFloat(match[0].replace(",", "."));
  }

  // Variant güncelle
  await shopifyREST(`/variants/${variantId}.json`, "PUT", {
    variant: {
      id: variantId,
      price: parsedPrice,
      sku: product.RotaNo,
      inventory_policy: "deny",
      inventory_management: "shopify",
      weight: weightValue,
      weight_unit: "lb",
    },
  });

  // Stok güncelle
  if (locationId && product.Stock !== undefined) {
    try {
      await shopifyREST("/inventory_levels/set.json", "POST", {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: product.Stock ?? 0,
      });
    } catch (err) {
      console.warn("⚠️ Stok güncellenemedi:", err);
    }
  }
}

// ✅ PUT handler
export async function PUT(req: NextRequest) {
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
    const { productId, variantId, inventoryItemId, existingMediaIds } =
      await findProductByRotaNo(rotaNo);

    // 2. Location ID çek
    const locationId = await getLocationId();

    // 3. Paralel: product core update + variant update
    await Promise.all([
      updateProductCore(productId, body),
      updateVariant(variantId, inventoryItemId, body, locationId),
    ]);

    // 4. Fotoğrafları güncelle (önce sil, sonra ekle)
    if (body.Photos !== undefined) {
      await deleteProductMedia(productId, existingMediaIds);
      if (body.Photos.length > 0) {
        await addProductMedia(productId, body.Photos, body.ProductEn);
      }
    }

    return NextResponse.json({
      ok: true,
      productId,
      variantId,
      rotaNo,
    });
  } catch (err: any) {
    console.error("❌ Product update error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
