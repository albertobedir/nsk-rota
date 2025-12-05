import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MetafieldFilter {
  "raw.metafields": {
    $elemMatch: {
      namespace: string;
      key: string;
      value: RegExp | { $in: RegExp[] };
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
      model = "",
      type = "",
      description = "",
      instock = "",
    } = Object.fromEntries(req.nextUrl.searchParams);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const batchNum = parseInt(batchSize, 10);

    const skipBatch =
      Math.floor(((pageNum - 1) * limitNum) / batchNum) * batchNum;

    const metafieldConditions: MetafieldFilter[] = [];

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

    if (oem) {
      const oemValues = oem
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const oemRegex = oemValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "oem_code",
            value: { $in: oemRegex },
          },
        },
      });
    }

    if (brand) {
      const brandValues = brand
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const brandRegex = brandValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "brand",
            value: { $in: brandRegex },
          },
        },
      });
    }

    if (model) {
      const modelValues = model
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const modelRegex = modelValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "model",
            value: { $in: modelRegex },
          },
        },
      });
    }

    if (type) {
      const typeValues = type
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const typeRegex = typeValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "type",
            value: { $in: typeRegex },
          },
        },
      });
    }

    if (description) {
      const descValues = description
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const descRegex = descValues.map((v) => new RegExp(v, "i"));

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "description",
            value: { $in: descRegex },
          },
        },
      });
    }

    if (instock) {
      const instockValue = instock.toLowerCase() === "true" || instock === "1";

      metafieldConditions.push({
        "raw.metafields": {
          $elemMatch: {
            namespace: "custom",
            key: "instock",
            value: instockValue ? /true|1|yes/i : /false|0|no/i,
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
        model,
        type,
        description,
        instock,
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
