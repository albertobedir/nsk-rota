/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetafieldValue =
  | RegExp
  | { $regex: string; $options?: string }
  | { $in: RegExp[] };

interface MetafieldFilter {
  "raw.metafields": {
    $elemMatch: {
      namespace: string;
      key: string;
      value: MetafieldValue;
    };
  };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const {
      search = "",
      shopifyId = "",
      variantId = "",
      title = "",
      page = "1",
      limit = "50",
      batchSize = "100",
      oem = "",
      brand = "",
      competitor = "",
      stockStatus = "",
      instock = "",
      location = "",
      description = "",
      model = "",
      type = "",
    } = Object.fromEntries(req.nextUrl.searchParams) as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const batchNum = parseInt(batchSize, 10);

    const skipBatch =
      Math.floor(((pageNum - 1) * limitNum) / batchNum) * batchNum;

    const metafieldConditions: any[] = [];
    // baseQuery holds explicit id-based filters (shopifyId / variant id)
    const baseQuery: Record<string, any> = {};

    // If a specific Shopify product id is provided, search by it
    if (shopifyId) {
      const num = Number(shopifyId);
      if (!Number.isNaN(num)) {
        // Exact match on numeric shopifyId
        Object.assign(baseQuery, { shopifyId: num });
      }
    }

    // Title-based exact lookup (case-insensitive)
    if (!shopifyId && !variantId && title) {
      Object.assign(baseQuery, {
        "raw.title": { $regex: `^${title.trim()}$`, $options: "i" },
      });
    }

    // If a specific variant id is provided, search by variant id inside raw.variants
    if (!shopifyId && variantId) {
      const vnum = Number(variantId);
      if (!Number.isNaN(vnum)) {
        Object.assign(baseQuery, { "raw.variants.id": vnum });
      }
    }

    // Rota No / OEM search (accepts RotaNo or OemNo inside oem_info)
    if (search) {
      const searchValues = search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const regexArray = searchValues.map((v) => new RegExp(v, "i"));
      const combinedPattern = searchValues.map((v) => `(${v})`).join("|");

      // Match rota_no, oem_info JSON (RotaNo/OemNo) OR competitor_info JSON (ReferansView)
      metafieldConditions.push({
        $or: [
          {
            "raw.metafields": {
              $elemMatch: {
                namespace: "custom",
                key: "rota_no",
                value: { $in: regexArray },
              },
            },
          },
          {
            "raw.metafields": {
              $elemMatch: {
                namespace: "custom",
                key: "oem_info",
                value: {
                  $regex: combinedPattern,
                  $options: "i",
                },
              },
            },
          },
          {
            "raw.metafields": {
              $elemMatch: {
                namespace: "custom",
                key: "competitor_info",
                value: {
                  $regex: combinedPattern,
                  $options: "i",
                },
              },
            },
          },
        ],
      });
    }

    // OEM search - JSON array içinde arama (oem_info metafield)
    if (oem) {
      const oemValues = oem
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "oem_info",
            value: {
              $regex: oemValues.join("|"),
              $options: "i",
            },
          },
        },
      });
    }

    // Brand search - JSON array içinde arama (brand_info metafield)
    if (brand) {
      const brandValues = brand
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "brand_info",
            value: {
              $regex: brandValues.join("|"),
              $options: "i",
            },
          },
        },
      });
    }

    // Competitor search - JSON array içinde arama (competitor_info metafield)
    if (competitor) {
      const competitorValues = competitor
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "competitor_info",
            value: {
              $regex: competitorValues.join("|"),
              $options: "i",
            },
          },
        },
      });
    }

    // Stock Status filter (stock_status metafield)
    if (stockStatus) {
      const statusRegex = new RegExp(stockStatus, "i");

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "stock_status",
            value: statusRegex,
          },
        },
      });
    }

    // In-stock filter: only products with at least one variant having inventory_quantity > 0
    if (instock === "IN") {
      metafieldConditions.push({
        "raw.variants": {
          $elemMatch: {
            inventory_quantity: { $gt: 0 },
          },
        },
      } as any);
    }

    // Location filter (stock_location metafield)
    if (location) {
      const locationRegex = new RegExp(location, "i");

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "stock_location",
            value: locationRegex,
          },
        },
      });
    }

    // Description filter — exact title match (anchored, case-insensitive)
    // Uses word-boundary anchors so "Tie Rod End" won't match "V-Rod"
    if (description) {
      const escaped = description.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      metafieldConditions.push({
        "raw.title": { $regex: `^${escaped}$`, $options: "i" },
      } as any);
    }

    // Model filter — matched against brand_info metafield
    if (model) {
      const modelValues = model
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const modelPattern = modelValues
        .map((v) => `\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
        .join("|");
      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "brand_info",
            value: { $regex: modelPattern, $options: "i" },
          },
        },
      });
    }

    // Type filter — matched against brand_info metafield
    if (type) {
      const typeValues = type
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const typePattern = typeValues
        .map((v) => `\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
        .join("|");
      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "brand_info",
            value: { $regex: typePattern, $options: "i" },
          },
        },
      });
    }

    // Merge metafield conditions with any explicit id-based query above
    const metaQuery =
      metafieldConditions.length > 0 ? { $and: metafieldConditions } : null;

    let finalQuery: Record<string, any> = {};
    const hasBase = Object.keys(baseQuery).length > 0;
    const hasMeta = metaQuery != null;

    if (hasBase && hasMeta) {
      finalQuery = { $and: [baseQuery, metaQuery] };
    } else if (hasBase) {
      finalQuery = baseQuery;
    } else if (hasMeta) {
      finalQuery = metaQuery as Record<string, any>;
    } else {
      finalQuery = {};
    }

    const batchResults = (await Product.find(finalQuery)
      .sort({ createdAt: -1 })
      .skip(skipBatch)
      .limit(batchNum)
      .lean()) as any[];

    const sliceStart = ((pageNum - 1) * limitNum) % batchNum;
    const results = batchResults.slice(
      sliceStart,
      sliceStart + limitNum,
    ) as any[];

    const total = await Product.countDocuments(finalQuery);

    // If a customer is logged in, try to fetch customer-specific pricing
    // from Shopify metaobjects and override product prices in the results.
    try {
      const customerId = req.cookies.get("customer_id")?.value;
      if (customerId) {
        const META_Q = `
          query GetCustomerPricing($query: String!, $first: Int!) {
            metaobjects(type: "customer_pricing", first: $first, query: $query) {
              edges {
                node {
                  fields { key value reference { ... on Product { id } } }
                }
              }
            }
          }
        `;

        const resp = await shopifyAdminFetch({
          query: META_Q,
          variables: { query: `customer:${customerId}`, first: 250 },
        });

        const metaedges = resp?.data?.metaobjects?.edges ?? [];
        const priceMap: Record<string, number> = {};

        for (const e of metaedges) {
          const node = e.node as any;
          const fields = node.fields as any[];
          const priceField = fields.find((f) => f.key === "price");
          const productRef = fields.find((f) => f.key === "product")?.reference;
          if (priceField?.value && productRef?.id) {
            // productRef.id is a GID like gid://shopify/Product/12345
            const match = String(productRef.id).match(/\/(\d+)$/);
            const numeric = match ? match[1] : null;
            if (numeric) priceMap[numeric] = parseFloat(priceField.value);
          }
        }

        if (Object.keys(priceMap).length > 0) {
          for (const p of results) {
            try {
              const shopifyId = String((p as any).shopifyId);
              const cp = priceMap[shopifyId];
              if (
                cp != null &&
                Array.isArray((p as any).raw?.variants) &&
                (p as any).raw.variants.length > 0
              ) {
                // override first variant price (string expected)
                (p as any).raw.variants[0].price = String(cp.toFixed(2));
                // also expose a convenient currentPrice field
                (p as any).currentPrice = String(cp.toFixed(2));
              }
            } catch (e) {
              /* ignore per-item errors */
            }
          }
        }
      }
    } catch (e) {
      console.warn("Customer pricing override failed:", e);
    }

    return NextResponse.json({
      ok: true,
      total,
      page: pageNum,
      limit: limitNum,
      batchSize: batchNum,
      appliedFilters: {
        search,
        oem,
        brand,
        competitor,
        stockStatus,
        location,
      },
      results,
    });
  } catch (err) {
    console.error("Products API error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
