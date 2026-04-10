/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
import { NextRequest, NextResponse } from "next/server";
import responseJson from "@/static/response.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const products = await Product.find({}, { raw: 1 }).lean();
    let updated = 0;

    for (const product of products) {
      const raw = (product as any).raw;
      const metafields = Array.isArray(raw?.metafields) ? raw.metafields : [];

      // Find real model from applications metafield
      const applicationsMeta = metafields.find(
        (m: any) => m.key === "applications" && m.namespace === "custom",
      );

      let modelDescription: string | null = null;
      let brandDescription: string | null = null;
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

      // If we have a real model, update with correct model+type
      if (modelDescription) {
        // Remove old model_info and type_info if they exist
        const metafieldsFiltered = metafields.filter(
          (m: any) =>
            !(
              (m.key === "model_info" || m.key === "type_info") &&
              m.namespace === "custom"
            ),
        );

        // Add correct model_info
        metafieldsFiltered.push({
          namespace: "custom",
          key: "model_info",
          value: JSON.stringify([modelDescription]),
          type: "json",
        });

        // Find types for this model under this brand
        try {
          const brandInfoMeta = metafieldsFiltered.find(
            (m: any) => m.key === "brand_info" && m.namespace === "custom",
          );
          if (brandInfoMeta?.value) {
            const brandInfo = JSON.parse(brandInfoMeta.value);
            brandDescription = Array.isArray(brandInfo)
              ? brandInfo[0]?.BrandDescription
              : brandInfo?.BrandDescription;

            if (brandDescription) {
              const tree = responseJson.tree as any;
              const brandTree = (tree as any)[brandDescription as string];

              if (brandTree && (brandTree as any)[modelDescription]) {
                const types = Object.keys(brandTree[modelDescription]);
                metafieldsFiltered.push({
                  namespace: "custom",
                  key: "type_info",
                  value: JSON.stringify(types),
                  type: "json",
                });
              }
            }
          }
        } catch (e) {
          console.warn("Error finding types:", e);
        }

        // Update product
        await Product.updateOne(
          { _id: (product as any)._id },
          { $set: { "raw.metafields": metafieldsFiltered } },
        );

        updated++;
        console.log(
          `✅ Fixed ${brandDescription} - ${modelDescription} - product`,
        );
      } else {
        // No applications data - remove model_info and type_info to avoid incorrect filtering
        const hasOldModelInfo = metafields.some(
          (m: any) => m.key === "model_info" && m.namespace === "custom",
        );
        const hasOldTypeInfo = metafields.some(
          (m: any) => m.key === "type_info" && m.namespace === "custom",
        );

        if (hasOldModelInfo || hasOldTypeInfo) {
          const metafieldsFiltered = metafields.filter(
            (m: any) =>
              !(
                (m.key === "model_info" || m.key === "type_info") &&
                m.namespace === "custom"
              ),
          );

          await Product.updateOne(
            { _id: (product as any)._id },
            { $set: { "raw.metafields": metafieldsFiltered } },
          );

          updated++;
          console.log(
            `⚠️  Removed incorrect model/type info (no applications data)`,
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      updated,
      total: products.length,
    });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
