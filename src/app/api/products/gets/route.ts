/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import {
  escapeRegex,
  partNumberRegexSource,
} from "@/lib/utils/part-number";
import Product from "@/schemas/mongoose/product";
import { NextRequest, NextResponse } from "next/server";

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
      description: descParam = "",
      model = "",
      type = "",
    } = Object.fromEntries(req.nextUrl.searchParams) as Record<string, string>;

    let description = descParam;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const batchNum = parseInt(batchSize, 10);

    const skipBatch =
      Math.floor(((pageNum - 1) * limitNum) / batchNum) * batchNum;

    const metafieldConditions: any[] = [];
    const baseQuery: Record<string, any> = {};

    // Shopify ID ile arama
    if (shopifyId) {
      const num = Number(shopifyId);
      if (!Number.isNaN(num)) {
        Object.assign(baseQuery, { shopifyId: num });
      }
    }

    // Title ile exact arama
    if (!shopifyId && !variantId && title) {
      Object.assign(baseQuery, {
        "raw.title": { $regex: `^${title.trim()}$`, $options: "i" },
      });
    }

    // Variant ID ile arama
    if (!shopifyId && variantId) {
      const vnum = Number(variantId);
      if (!Number.isNaN(vnum)) {
        Object.assign(baseQuery, { "raw.variants.id": vnum });
      }
    }

    // ✅ SEARCH — rota_no, oem_info, competitor_info, applications, brand_info, sku, title, handle
    if (search) {
      const searchValues = search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const partPatterns = searchValues
        .map((v) => partNumberRegexSource(v))
        .filter(Boolean);
      const regexArray = partPatterns.map((p) => new RegExp(p, "i"));
      const combinedPartPattern = partPatterns.map((p) => `(${p})`).join("|");
      const literalPattern = searchValues
        .map((v) => `(${escapeRegex(v)})`)
        .join("|");

      if (partPatterns.length === 0) {
        metafieldConditions.push({ _id: { $exists: false } });
      } else {
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
                  value: { $regex: combinedPartPattern, $options: "i" },
                },
              },
            },
            {
              "raw.metafields": {
                $elemMatch: {
                  namespace: "custom",
                  key: "competitor_info",
                  value: { $regex: combinedPartPattern, $options: "i" },
                },
              },
            },
            // ✅ YENİ: applications metafield (BrandDescription, ModelDescription, Model2)
            {
              "raw.metafields": {
                $elemMatch: {
                  namespace: "custom",
                  key: "applications",
                  value: { $regex: literalPattern, $options: "i" },
                },
              },
            },
            // ✅ YENİ: brand_info metafield
            {
              "raw.metafields": {
                $elemMatch: {
                  namespace: "custom",
                  key: "brand_info",
                  value: { $regex: literalPattern, $options: "i" },
                },
              },
            },
            // SKU arama (variants.sku = RotaNo)
            {
              "raw.variants": {
                $elemMatch: {
                  sku: { $regex: combinedPartPattern, $options: "i" },
                },
              },
            },
            // Title ve handle fallback
            { "raw.title": { $regex: literalPattern, $options: "i" } },
            { "raw.handle": { $regex: literalPattern, $options: "i" } },
          ],
        });
      }
    }

    // OEM arama
    if (oem) {
      const oemValues = oem
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const oemPattern = oemValues
        .map((v) => partNumberRegexSource(v))
        .filter(Boolean)
        .map((p) => `(${p})`)
        .join("|");

      if (oemPattern) {
        metafieldConditions.push({
          "raw.metafields": {
            $elemMatch: {
              namespace: "custom",
              key: "oem_info",
              value: { $regex: oemPattern, $options: "i" },
            },
          },
        });
      }
    }

    // Brand filtresi — applications metafield (BrandDescription)
    if (brand) {
      const brandValues = brand
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const brandPattern = brandValues
        .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      metafieldConditions.push({
        $or: [
          // applications metafield
          {
            "raw.metafields": {
              $elemMatch: {
                namespace: "custom",
                key: "applications",
                value: {
                  $regex: `"BrandDescription"\\s*:\\s*"[^"]*(?:${brandPattern})[^"]*"`,
                  $options: "i",
                },
              },
            },
          },
          // ✅ YENİ: brand_info metafield da kontrol et
          {
            "raw.metafields": {
              $elemMatch: {
                namespace: "custom",
                key: "brand_info",
                value: {
                  $regex: `"BrandDescription"\\s*:\\s*"[^"]*(?:${brandPattern})[^"]*"`,
                  $options: "i",
                },
              },
            },
          },
        ],
      });
    }

    // Competitor arama
    if (competitor) {
      const competitorValues = competitor
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const competitorPattern = competitorValues
        .map((v) => partNumberRegexSource(v))
        .filter(Boolean)
        .map((p) => `(${p})`)
        .join("|");

      if (competitorPattern) {
        metafieldConditions.push({
          "raw.metafields": {
            $elemMatch: {
              namespace: "custom",
              key: "competitor_info",
              value: { $regex: competitorPattern, $options: "i" },
            },
          },
        });
      }
    }

    // Stock status filtresi
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

    // In-stock filtresi
    if (instock === "IN") {
      metafieldConditions.push({
        "raw.variants": {
          $elemMatch: {
            inventory_quantity: { $gt: 0 },
          },
        },
      } as any);
    }

    // Location filtresi
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

    // Description filtresi — title üzerinden partial match
    if (description) {
      const escaped = description.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      metafieldConditions.push({
        "raw.title": { $regex: `\\b${escaped}`, $options: "i" },
      } as any);
    }

    // Model filtresi — applications metafield (ModelDescription)
    if (model) {
      const modelValues = model
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const modelPattern = modelValues
        .map((v) => `\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
        .join("|");

      if (modelPattern) {
        metafieldConditions.push({
          "raw.metafields": {
            $elemMatch: {
              namespace: "custom",
              key: "applications",
              value: {
                $regex: `"ModelDescription"\\s*:\\s*"([^"]*(?:${modelPattern})[^"]*)`,
                $options: "i",
              },
            },
          },
        });
      }
    }

    // Type filtresi — applications metafield (VehicleType veya Model2)
    if (type) {
      const typeValues = type
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const typePattern = typeValues
        .map((v) => `\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
        .join("|");

      if (typePattern) {
        metafieldConditions.push({
          $or: [
            {
              "raw.metafields": {
                $elemMatch: {
                  namespace: "custom",
                  key: "applications",
                  value: {
                    $regex: `"VehicleType"\\s*:\\s*"(${typePattern})"`,
                    $options: "i",
                  },
                },
              },
            },
            {
              "raw.metafields": {
                $elemMatch: {
                  namespace: "custom",
                  key: "applications",
                  value: {
                    $regex: `"Model2"\\s*:\\s*"(${typePattern})"`,
                    $options: "i",
                  },
                },
              },
            },
          ],
        });
      }
    }

    // Final query birleştirme
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
        model,
        type,
        description,
        competitor,
        stockStatus,
        instock,
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
