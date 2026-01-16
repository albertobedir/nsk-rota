/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopifyVariantId, locationId, increment, setStock, apiKey, token } =
      body;

    if (apiKey !== process.env.WEBHOOK_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Unauthorized (apiKey)" },
        { status: 401 }
      );
    }

    if (token !== process.env.WEBHOOK_AUTH_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized (token)" },
        { status: 401 }
      );
    }

    if (!shopifyVariantId) {
      return NextResponse.json(
        { success: false, error: "shopifyVariantId is required" },
        { status: 400 }
      );
    }

    const variantGid = shopifyVariantId.startsWith("gid://")
      ? shopifyVariantId
      : `gid://shopify/ProductVariant/${shopifyVariantId}`;

    const inventoryData = await getInventoryLevels(variantGid, locationId);

    if (!inventoryData) {
      return NextResponse.json(
        { success: false, error: "Variant or location not found" },
        { status: 404 }
      );
    }

    const { inventoryItemId, currentStock, locationName, finalLocationId } =
      inventoryData;

    let newStock = currentStock;
    let operation: "increment" | "decrement" | "set" | "none" = "none";
    let mutationResult: any = null;

    if (setStock !== undefined && setStock !== null) {
      mutationResult = await setInventoryQuantity(
        inventoryItemId,
        finalLocationId,
        setStock
      );
      const changes =
        mutationResult.data?.inventorySetQuantities?.inventoryAdjustmentGroup
          ?.changes;
      newStock = changes?.[0]?.quantityAfterChange ?? setStock;
      operation = "set";
    } else if (increment !== undefined && increment !== null) {
      const delta = increment ? 1 : -1;
      mutationResult = await adjustInventoryQuantity(
        inventoryItemId,
        finalLocationId,
        delta
      );
      const changes =
        mutationResult.data?.inventoryAdjustQuantities?.inventoryAdjustmentGroup
          ?.changes;
      newStock = changes?.[0]?.quantityAfterChange ?? currentStock + delta;
      operation = increment ? "increment" : "decrement";
    }

    console.log("Final stock value:", newStock);

    await syncInventoryToDatabase({
      variantId: variantGid,
      locationId: finalLocationId,
      stock: newStock,
    });

    return NextResponse.json({
      success: true,
      data: {
        variantId: variantGid,
        locationId: finalLocationId,
        locationName,
        previousStock: currentStock,
        newStock,
        operation,
      },
    });
  } catch (error: any) {
    console.error("Inventory update error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}

async function getInventoryLevels(variantGid: string, locationId?: string) {
  const query = `
    query getInventoryLevels($variantId: ID!) {
      productVariant(id: $variantId) {
        id
        inventoryItem {
          id
          inventoryLevels(first: 10) {
            edges {
              node {
                id
                quantities(names: "available") {
                  name
                  quantity
                }
                location {
                  id
                  name
                  isActive
                }
              }
            }
          }
        }
      }
    }
  `;

  const resp = await shopifyAdminRequest(query, { variantId: variantGid });

  if (resp.errors) {
    console.error("GraphQL Errors:", resp.errors);
    return null;
  }

  const invLevels =
    resp.data?.productVariant?.inventoryItem?.inventoryLevels?.edges || [];
  const inventoryItemId = resp.data?.productVariant?.inventoryItem?.id;

  if (invLevels.length === 0) return null;

  let selectedLevel: any = null;
  if (locationId) {
    const locationGid = locationId.startsWith("gid://")
      ? locationId
      : `gid://shopify/Location/${locationId}`;
    selectedLevel = invLevels.find(
      (edge: any) => edge.node.location.id === locationGid
    );
  } else {
    selectedLevel =
      invLevels.find((edge: any) => edge.node.location.isActive) ||
      invLevels[0];
  }

  if (!selectedLevel) return null;

  const availableQty = selectedLevel.node.quantities?.find(
    (q: any) => q.name === "available"
  );
  const currentStock = availableQty?.quantity ?? 0;

  return {
    inventoryLevelId: selectedLevel.node.id,
    inventoryItemId,
    currentStock,
    locationName: selectedLevel.node.location.name,
    finalLocationId: selectedLevel.node.location.id,
  };
}

async function setInventoryQuantity(
  inventoryItemId: string,
  locationId: string,
  quantity: number
) {
  const mutation = `
    mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup { 
          id 
          reason
          changes {
            name
            quantityAfterChange
          }
        }
        userErrors { 
          field 
          message 
        }
      }
    }
  `;

  const input = {
    reason: "correction",
    name: "available",
    ignoreCompareQuantity: true, // ÖNEMLİ: Bu satırı ekle
    quantities: [
      {
        inventoryItemId: inventoryItemId,
        locationId: locationId,
        quantity,
      },
    ],
  };

  const result = await shopifyAdminRequest(mutation, { input });

  console.log("Set Inventory Result:", JSON.stringify(result, null, 2));

  if (result.errors) {
    console.error("GraphQL Errors:", result.errors);
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  if (result.data?.inventorySetQuantities?.userErrors?.length > 0) {
    const errors = result.data.inventorySetQuantities.userErrors;
    console.error("User Errors:", errors);
    throw new Error(`Inventory set failed: ${JSON.stringify(errors)}`);
  }

  return result;
}

async function adjustInventoryQuantity(
  inventoryItemId: string,
  locationId: string,
  delta: number
) {
  const mutation = `
    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors {
          field
          message
        }
        inventoryAdjustmentGroup {
          id
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
      }
    }
  `;

  const input = {
    reason: "correction",
    name: "available",
    changes: [
      {
        inventoryItemId: inventoryItemId,
        locationId: locationId,
        delta: delta,
      },
    ],
  };

  const result = await shopifyAdminRequest(mutation, { input });

  console.log("Adjust Inventory Result:", JSON.stringify(result, null, 2));

  if (result.errors) {
    console.error("GraphQL Errors:", result.errors);
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  if (result.data?.inventoryAdjustQuantities?.userErrors?.length > 0) {
    const errors = result.data.inventoryAdjustQuantities.userErrors;
    console.error("User Errors:", errors);
    throw new Error(`Inventory adjust failed: ${JSON.stringify(errors)}`);
  }

  return result;
}

async function shopifyAdminRequest(query: string, variables: any) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token!,
    },
    body: JSON.stringify({ query, variables }),
  });

  return await res.json();
}

async function syncInventoryToDatabase({
  variantId,
  locationId,
  stock,
}: {
  variantId: string;
  locationId: string;
  stock: number;
}) {
  try {
    await connectDB();

    const shortVariantId = String(variantId).split("/").pop();
    const shortVariantIdNum = Number(shortVariantId);

    const product = await Product.findOne({
      $or: [
        { "raw.variants.id": variantId },
        { "raw.variants.id": shortVariantId },
        { "raw.variants.id": shortVariantIdNum },
      ],
    }).exec();

    if (!product) {
      console.warn("No product found for variant", variantId);
      return;
    }

    const variants = (product.raw as any).variants || [];
    let updated = false;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const vid = String(v.id);
      const vidShort = vid.split("/").pop();
      if (
        vid === variantId ||
        vidShort === shortVariantId ||
        Number(vid) === shortVariantIdNum
      ) {
        const invLocs = v.inventory_locations || [];
        const locShort = String(locationId).split("/").pop();

        let found = false;
        for (let j = 0; j < invLocs.length; j++) {
          const loc = invLocs[j];
          const existingLocId = String(loc.location_id || "")
            .split("/")
            .pop();
          if (existingLocId === locShort) {
            invLocs[j] = {
              ...loc,
              available: stock,
              location_id: locShort,
              updated_at: new Date(),
            };
            found = true;
            break;
          }
        }

        if (!found) {
          invLocs.push({
            location_id: locShort,
            location_name: "",
            available: stock,
            incoming: 0,
            updated_at: new Date(),
          });
        }

        // update location-level data
        variants[i].inventory_locations = invLocs;
        // also update variant-level stock fields so frontend/consumers see correct totals
        variants[i].inventory_quantity = stock;
        variants[i].old_inventory_quantity = stock;
        updated = true;
        break;
      }
    }

    if (updated) {
      try {
        (product.raw as any).variants = variants;
        // mark modified so mongoose knows to persist the Mixed field
        product.markModified("raw.variants");
        product.markModified("raw");
        product.set("raw", product.raw);
        await product.save();
        console.log("Product inventory saved to Mongo for variant", variantId);
      } catch (saveErr) {
        console.error(
          "Failed to save product after inventory change:",
          saveErr
        );
        // fallback to updateOne if save fails
        try {
          await Product.updateOne(
            { _id: product._id },
            { $set: { "raw.variants": variants, "raw.updatedAt": new Date() } }
          ).exec();
          console.log(
            "Product inventory updated via updateOne for variant",
            variantId
          );
        } catch (upErr) {
          console.error("Fallback updateOne also failed:", upErr);
        }
      }
    }
  } catch (err) {
    console.error("syncInventoryToDatabase error:", err);
  }
}
