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

// ✅ Publication IDs çek
async function getPublications() {
  const query = `
    query {
      publications(first: 10) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;
  const res = await shopifyGraphQL(query);
  return res.data?.publications?.edges?.map((e: any) => e.node.id) || [];
}

// ✅ Location ID çek
async function getLocationId() {
  const res = await shopifyREST("/locations.json");
  return res.locations?.[0]?.id || null;
}

// ✅ Variant güncelle + stok ayarla
async function updateVariant(
  productId: string,
  variantData: any,
  locationId: number,
) {
  // 1. Variant ID çek
  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;
  const res = await shopifyGraphQL(query, { id: productId });
  const variantGid = res.data?.product?.variants?.edges?.[0]?.node?.id;
  if (!variantGid) throw new Error("Variant ID bulunamadı");

  const variantId = variantGid.split("/").pop();

  // 2. Variant güncelle (REST)
  const updateRes = await shopifyREST(`/variants/${variantId}.json`, "PUT", {
    variant: {
      id: variantId,
      price: variantData.price,
      sku: variantData.sku,
      inventory_policy: "deny",
      inventory_management: "shopify",
      weight: variantData.weight,
      weight_unit: "lb",
    },
  });

  // 3. Stok ayarla
  const inventoryItemId = updateRes.variant?.inventory_item_id;
  if (inventoryItemId && locationId) {
    try {
      await shopifyREST("/inventory_levels/set.json", "POST", {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: variantData.stock ?? 0,
      });
    } catch (err) {
      console.warn("⚠️ Stok ayarlanamadı:", err);
    }
  }

  return variantId;
}

// ✅ Yayımla
async function publishProduct(productId: string, publicationIds: string[]) {
  if (publicationIds.length === 0) return;

  const mutation = `
    mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    await shopifyGraphQL(mutation, {
      id: productId,
      input: publicationIds.map((id) => ({ publicationId: id })),
    });
  } catch (err) {
    console.warn("⚠️ Yayımlama hatası:", err);
  }
}

// ✅ Ana ürün oluşturma
async function createProduct(product: any) {
  const mutation = `
    mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) {
        product {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Price parse
  const parsedPrice = product.Price
    ? parseFloat(product.Price.replace(",", ".")).toFixed(2)
    : "0.00";

  // Weight parse
  let weightValue = 0;
  if (product.Weight?.lb) {
    const match = product.Weight.lb.match(/[\d,\.]+/);
    if (match) weightValue = parseFloat(match[0].replace(",", "."));
  }

  const vendor = product.Brands?.[0]?.BrandDescription || "";
  const productType = product.Brands?.[0]?.BrandClass || "";

  // Tags
  const tags = [
    productType,
    ...product.Brands.map((b: any) => b.BrandDescription),
    ...product.Oems.map((oem: any) => oem.MarkaDescription),
    ...product.Competiters.map((c: any) => c.CompetitorName),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const descriptionHtml = `<p>${product.ProductEn}</p>`;

  // Metafields
  const metafields: any[] = [];
  if (product.Oems?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "oem_info",
      type: "json",
      value: JSON.stringify(product.Oems),
    });
  if (product.Details?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "technical_info",
      type: "json",
      value: JSON.stringify(product.Details),
    });
  if (product.Competiters?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "competitor_info",
      type: "json",
      value: JSON.stringify(product.Competiters),
    });
  if (product.Components?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "comp",
      type: "json",
      value: JSON.stringify(product.Components),
    });
  if (product.Applications?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "applications",
      type: "json",
      value: JSON.stringify(product.Applications),
    });
  if (product.Pairings?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "pairings",
      type: "json",
      value: JSON.stringify(product.Pairings),
    });
  if (product.Brands?.length > 0)
    metafields.push({
      namespace: "custom",
      key: "brand_info",
      type: "json",
      value: JSON.stringify(product.Brands),
    });

  // Media (Photos)
  const sortedPhotos =
    product.Photos?.length > 0
      ? [...product.Photos].sort((a: string, b: string) => {
          const aIsMain = /products\/\d{5,}/.test(a);
          const bIsMain = /products\/\d{5,}/.test(b);
          if (aIsMain && !bIsMain) return -1;
          if (!aIsMain && bIsMain) return 1;
          return 0;
        })
      : [];

  const media =
    sortedPhotos.length > 0
      ? sortedPhotos.map((url: string, index: number) => ({
          originalSource: url,
          alt: `${product.ProductEn} - Image ${index + 1}`,
          mediaContentType: "IMAGE",
        }))
      : [];

  const variables = {
    input: {
      title: `${product.ProductEn} - ${product.RotaNo}`,
      descriptionHtml,
      vendor,
      productType,
      status: "ACTIVE",
      tags,
      metafields,
    },
    media: media.length > 0 ? media : undefined,
  };

  const response = await shopifyGraphQL(mutation, variables);

  if (response.data?.productCreate?.userErrors?.length > 0) {
    throw new Error(JSON.stringify(response.data.productCreate.userErrors));
  }

  const productId = response.data?.productCreate?.product?.id;
  if (!productId) throw new Error("Product ID alınamadı");

  return {
    productId,
    handle: response.data.productCreate.product.handle,
    parsedPrice,
    weightValue,
  };
}

// ✅ POST handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validasyon
    if (!body.RotaNo || !body.ProductEn || !body.Brands?.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "RotaNo, ProductEn ve Brands gereklidir",
        },
        { status: 400 },
      );
    }

    // 1. Publication ve Location ID'leri çek
    const [publicationIds, locationId] = await Promise.all([
      getPublications(),
      getLocationId(),
    ]);

    // 2. Ürünü oluştur
    const { productId, handle, parsedPrice, weightValue } =
      await createProduct(body);

    // 3. Variant güncelle
    const variantId = await updateVariant(
      productId,
      {
        sku: body.RotaNo,
        price: parsedPrice,
        weight: weightValue,
        stock: body.Stock ?? 0,
      },
      locationId,
    );

    // 4. Yayımla
    await publishProduct(productId, publicationIds);

    return NextResponse.json({
      ok: true,
      productId,
      variantId,
      handle,
    });
  } catch (err: any) {
    console.error("❌ Product creation error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
