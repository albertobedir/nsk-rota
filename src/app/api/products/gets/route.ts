import { connectDB } from "@/lib/mongoose/instance";
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
