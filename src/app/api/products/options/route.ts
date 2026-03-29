/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function collectValuesFromField(val: any): string[] {
  if (!val && val !== 0) return [];
  if (Array.isArray(val))
    return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val === "string") {
    // try parse as JSON array
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed))
        return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch (e) {
      // not JSON
    }
    return String(val)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(val).trim()];
}

export async function GET(_req: NextRequest) {
  try {
    await connectDB();

    const products = await Product.find({}, { raw: 1 }).lean();

    const brands = new Set<string>();
    const models = new Set<string>();
    const types = new Set<string>();
    const descs = new Set<string>();
    const stocks = new Set<string>();

    for (const p of products) {
      const mfs = (p as any).raw?.metafields ?? [];
      if (Array.isArray(mfs)) {
        for (const mf of mfs) {
          const key = String(mf.key || "").toLowerCase();
          const vals = collectValuesFromField(mf.value);
          if (!vals.length) continue;

          // ✅ FIXED: Extract brands, models, types from applications metafield
          if (key === "applications") {
            try {
              const apps = JSON.parse(mf.value);
              if (Array.isArray(apps)) {
                for (const app of apps) {
                  if (app.BrandDescription) brands.add(app.BrandDescription);
                  if (app.ModelDescription) models.add(app.ModelDescription);
                  if (app.VehicleType) types.add(app.VehicleType);
                  if (app.Model2) types.add(app.Model2);
                }
              }
            } catch (e) {
              // fallback to string parsing if JSON parse fails
              vals.forEach((v) => {
                if (v.includes("BrandDescription")) brands.add(v);
                if (v.includes("ModelDescription")) models.add(v);
                if (v.includes("VehicleType")) types.add(v);
                if (v.includes("Model2")) types.add(v);
              });
            }
          }

          // keep other field extraction as before for backward compatibility
          if (key.includes("brand")) vals.forEach((v) => brands.add(v));
          else if (key.includes("model")) vals.forEach((v) => models.add(v));
          else if (key.includes("type")) vals.forEach((v) => types.add(v));
          else if (
            key.includes("desc") ||
            key.includes("description") ||
            key.includes("part")
          )
            vals.forEach((v) => descs.add(v));
          else if (key.includes("stock")) vals.forEach((v) => stocks.add(v));
        }
      }

      // fallback: try to infer from title / raw.title
      const title = (p as any).raw?.title;
      if (title && typeof title === "string") {
        const parts = title
          .split(/[-|:,\\/]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) parts.forEach((t) => descs.add(t));
      }
    }

    return NextResponse.json({
      ok: true,
      options: {
        brand: Array.from(brands).sort(),
        model: Array.from(models).sort(),
        type: Array.from(types).sort(),
        desc: Array.from(descs).sort(),
        stock: Array.from(stocks).sort(),
      },
    });
  } catch (err) {
    console.error("Options API error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
