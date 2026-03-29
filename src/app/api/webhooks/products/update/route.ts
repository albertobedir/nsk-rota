/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
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

async function fetchProductMetafields(productId: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        metafields(first: 100) {
          edges {
            node {
              namespace
              key
              value
              type
            }
          }
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
      body: JSON.stringify({ query, variables: { id: productId } }),
    },
  );

  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    return [];
  }

  if (!data.data?.product?.metafields?.edges) {
    console.warn("No metafields found for product:", productId);
    return [];
  }

  return data.data.product.metafields.edges.map(
    (edge: { node: Record<string, unknown> }) => edge.node,
  );
}

// YENİ: Inventory locations çek (GraphQL ile)
async function fetchInventoryLocations(productId: string) {
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const query = `
    query getProductInventory($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
              inventoryItem {
                id
                inventoryLevels(first: 10) {
                  edges {
                    node {
                      location {
                        id
                        name
                      }
                      quantities(names: ["available", "incoming"]) {
                        name
                        quantity
                      }
                      updatedAt
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

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken!,
      },
      body: JSON.stringify({ query, variables: { id: productId } }),
    },
  );

  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL inventory errors:", data.errors);
    return {};
  }

  // Variant ID'ye göre location map'i oluştur
  const inventoryMap: Record<string, any[]> = {};

  const variants = data.data?.product?.variants?.edges || [];
  for (const variantEdge of variants) {
    const variant = variantEdge.node;
    const fullVariantId = variant.id; // e.g. "gid://shopify/ProductVariant/123"
    const shortVariantId = String(variant.id).split("/").pop() || "";

    const levels = variant.inventoryItem?.inventoryLevels?.edges || [];
    const mapped = levels.map((levelEdge: any) => {
      const node = levelEdge.node;
      const availableQty =
        node.quantities?.find((q: any) => q.name === "available")?.quantity ||
        0;
      const incomingQty =
        node.quantities?.find((q: any) => q.name === "incoming")?.quantity || 0;

      return {
        location_id: String(node.location.id).split("/").pop(),
        location_name: node.location.name,
        available: availableQty,
        incoming: incomingQty,
        updated_at: node.updatedAt,
      };
    });

    // Store under both full gid and short id for robustness
    inventoryMap[fullVariantId] = mapped;
    if (shortVariantId) inventoryMap[shortVariantId] = mapped;
  }

  return inventoryMap;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verified = verifyShopifyWebhook(req, rawBody);

    if (!verified) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const productData = JSON.parse(rawBody);
    console.log("Product updated - ID:", productData.id);

    let metafields = [];
    let inventoryMap: Record<string, any[]> = {};

    try {
      // Metafields ve inventory locations'ı paralel çek
      [metafields, inventoryMap] = await Promise.all([
        fetchProductMetafields(productData.admin_graphql_api_id),
        fetchInventoryLocations(productData.admin_graphql_api_id),
      ]);

      console.log("Metafields fetched:", metafields.length);
      console.log(
        "Inventory locations fetched for variants:",
        Object.keys(inventoryMap).length,
      );
      try {
        console.log("InventoryMap:", JSON.stringify(inventoryMap, null, 2));
      } catch {
        console.log("InventoryMap (non-serializable)", inventoryMap);
      }
    } catch (fetchErr) {
      console.error("Fetch error:", fetchErr);
    }

    // Variants'a inventory_locations ekle
    if (productData.variants && Array.isArray(productData.variants)) {
      const getInventoryFor = (variantId: any) => {
        if (!variantId) return [];
        const key = String(variantId);
        if (inventoryMap[key]) return inventoryMap[key];
        try {
          const short = String(variantId).split("/").pop();
          if (short && inventoryMap[short]) return inventoryMap[short];
        } catch {
          // ignore
        }
        return [];
      };

      productData.variants = productData.variants.map((variant: any) => {
        const inv = getInventoryFor(variant.id);
        console.log("Variant lookup:", {
          id: variant.id,
          short: String(variant.id).split("/").pop(),
          found: inv.length,
        });
        return { ...variant, inventory_locations: inv };
      });
    }

    const fullProduct = {
      ...productData,
      metafields,
      updatedAt: new Date(),
    };

    // Extract model_info and type_info from applications (real product model)
    try {
      const applicationsMeta = metafields.find(
        (m: any) => m.key === "applications" && m.namespace === "custom",
      );

      let modelDescription: string | null = null;
      if (applicationsMeta?.value) {
        try {
          const applications = JSON.parse(applicationsMeta.value);
          if (
            Array.isArray(applications) &&
            applications[0]?.ModelDescription
          ) {
            modelDescription = applications[0].ModelDescription;
          }
        } catch {
          // ignore
        }
      }

      // If we have a model, add it as model_info
      if (modelDescription) {
        if (!metafields.find((m: any) => m.key === "model_info")) {
          metafields.push({
            namespace: "custom",
            key: "model_info",
            value: JSON.stringify([modelDescription]),
            type: "json",
          });
        }

        // Now find types for this specific model under this brand
        try {
          const brandInfoMeta = metafields.find(
            (m: any) => m.key === "brand_info" && m.namespace === "custom",
          );
          if (brandInfoMeta?.value) {
            const brandInfo = JSON.parse(brandInfoMeta.value);
            const brandDescription = Array.isArray(brandInfo)
              ? brandInfo[0]?.BrandDescription
              : brandInfo?.BrandDescription;

            if (brandDescription) {
              const responseJson = await import("@/static/response.json");
              const tree = responseJson.default?.tree || {};
              const brandTree = tree[brandDescription];

              if (brandTree && brandTree[modelDescription]) {
                const types = Object.keys(brandTree[modelDescription]);
                if (!metafields.find((m: any) => m.key === "type_info")) {
                  metafields.push({
                    namespace: "custom",
                    key: "type_info",
                    value: JSON.stringify(types),
                    type: "json",
                  });
                }
                console.log(
                  `✅ Added correct model (${modelDescription}) and types for`,
                  brandDescription,
                );
              }
            }
          }
        } catch (brandErr) {
          console.warn("Error processing brand tree:", brandErr);
        }
      }
    } catch (extractErr) {
      console.warn("Error extracting model/type info:", extractErr);
    }

    await connectDB();

    await Product.updateOne(
      { shopifyId: productData.id },
      { $set: { raw: fullProduct } },
      { upsert: true },
    );

    console.log("Product saved with inventory locations");

    return NextResponse.json(
      { status: "ok", action: "updated", productId: productData.id },
      { status: 200 },
    );
  } catch (err) {
    console.error("Webhook update error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

//*
