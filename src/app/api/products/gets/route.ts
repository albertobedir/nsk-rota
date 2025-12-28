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
      page = "1",
      limit = "50",
      batchSize = "100",
      oem = "",
      brand = "",
      competitor = "",
      stockStatus = "",
      location = "",
    } = Object.fromEntries(req.nextUrl.searchParams);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const batchNum = parseInt(batchSize, 10);

    const skipBatch =
      Math.floor(((pageNum - 1) * limitNum) / batchNum) * batchNum;

    const metafieldConditions: MetafieldFilter[] = [];

    // Rota No search (ana ürün kodu)
    if (search) {
      const searchValues = search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const regexArray = searchValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "rota_no",
            value: { $in: regexArray },
          },
        },
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

    const query =
      metafieldConditions.length > 0 ? { $and: metafieldConditions } : {};

    const batchResults = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skipBatch)
      .limit(batchNum)
      .lean();

    const sliceStart = ((pageNum - 1) * limitNum) % batchNum;
    const results = batchResults.slice(sliceStart, sliceStart + limitNum);

    const total = await Product.countDocuments(query);

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
              const shopifyId = String(p.shopifyId);
              const cp = priceMap[shopifyId];
              if (cp != null && p.raw?.variants && p.raw.variants.length) {
                // override first variant price (string expected)
                p.raw.variants[0].price = String(cp.toFixed(2));
                // also expose a convenient currentPrice field
                p.currentPrice = String(cp.toFixed(2));
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
      { status: 500 }
    );
  }
}
