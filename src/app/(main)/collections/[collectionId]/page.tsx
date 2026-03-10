/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { connectDB } from "@/lib/mongoose/instance";
import Collection from "@/schemas/mongoose/collection";
import mongoose from "mongoose";
import Image from "next/image";
import CollectionProducts from "@/components/collection-products";
import Product from "@/schemas/mongoose/product";

// Keep this route dynamic
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: any }) {
  const { collectionId } = (await params) as { collectionId?: string };
  const id = String(collectionId ?? "");

  try {
    await connectDB();

    const conditions: any[] = [
      { "raw.handle": id },
      { handle: id },
      { shopifyId: id },
    ];

    if (mongoose.isValidObjectId(id)) conditions.push({ _id: id });

    const coll: any = await Collection.findOne({ $or: conditions }).lean();

    if (!coll) {
      return (
        <main className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Collection not found</h1>
            <p className="mb-4">No collection found for "{id}"</p>
            <Link href="/" className="text-primary underline">
              Go home
            </Link>
          </div>
        </main>
      );
    }

    // prepare products list for rendering (move async work here)
    const source =
      Array.isArray(coll?.productsFull) && coll.productsFull.length > 0
        ? coll.productsFull
        : Array.isArray(coll?.products)
          ? coll.products
          : [];

    const extractRotaNo = (metafields: any[] = []) => {
      try {
        const direct = metafields.find((m) => m.key === "rota_no")?.value;
        if (direct) return direct;

        const candidate = metafields.find(
          (m) =>
            m.key === "oem_info" ||
            m.key === "brand_info" ||
            (m.namespace === "custom" && /(oem|brand)/i.test(m.key)),
        );

        if (candidate) {
          try {
            const parsed = JSON.parse(candidate.value);
            if (Array.isArray(parsed) && parsed[0]) {
              return (
                parsed[0].RotaNo ||
                parsed[0].rotaNo ||
                parsed[0].Rota ||
                parsed[0].rota ||
                undefined
              );
            }
            if (parsed && typeof parsed === "object") {
              return (
                parsed.RotaNo || parsed.rotaNo || parsed.Rota || parsed.rota
              );
            }
          } catch {
            const m = String(candidate.value).match(/\d{3,}/);
            if (m) return m[0];
          }
        }

        return undefined;
      } catch {
        return undefined;
      }
    };

    // If the collection contains simple product references (only id/handle),
    // fetch the full product docs from the products collection to get images and other fields.
    const shopifyIds = source
      .map(
        (s: any) =>
          s?.id ?? s?.shopifyId ?? (s?.raw && s.raw.id ? s.raw.id : undefined),
      )
      .filter((v: any) => v !== undefined)
      .map((v: any) => Number(v));

    let productsFromDb: any[] = [];
    if (shopifyIds.length > 0) {
      try {
        productsFromDb = await Product.find({
          shopifyId: { $in: shopifyIds },
        }).lean();
      } catch (dbErr) {
        console.warn("Could not load product docs for collection", dbErr);
      }
    }

    const productMap = new Map<string, any>();
    for (const p of productsFromDb) {
      if (p && p.shopifyId) productMap.set(String(p.shopifyId), p);
    }

    const products = source.map((r: any, i: number) => {
      // if we have a db product, prefer its `raw` data for images/variants/metafields
      const refId =
        r?.id ?? r?.shopifyId ?? (r?.raw && r.raw.id ? r.raw.id : undefined);
      const dbProduct = refId ? productMap.get(String(refId)) : undefined;
      const raw = dbProduct && dbProduct.raw ? dbProduct.raw : (r.raw ?? r);
      const rotaNo =
        raw?.metafields && Array.isArray(raw.metafields)
          ? extractRotaNo(raw.metafields)
          : undefined;
      const codeVal =
        rotaNo ??
        raw?.handle ??
        String(r.shopifyId ?? r.id ?? r._id ?? `p-${i}`);
      const image =
        (raw?.images &&
          raw.images[0] &&
          (raw.images[0].src ?? raw.images[0].url)) ||
        raw?.image ||
        "";
      const price =
        Number(
          r.currentPrice ??
            raw?.variants?.[0]?.price ??
            raw?.variants?.[0]?.price_amount ??
            0,
        ) || 0;

      const oemsArr =
        raw?.metafields && Array.isArray(raw.metafields)
          ? raw.metafields
              .filter(
                (m: any) =>
                  /(oem|brand)/i.test(m.key) ||
                  (m.namespace === "custom" && /(oem|brand)/i.test(m.key)),
              )
              .map((m: any) => m.value)
          : [];

      // Build a serializable raw object (strip ObjectId/Buffer etc.)
      const rawSerializable: any = {
        title: raw?.title ?? raw?.name,
        handle: raw?.handle,
        images:
          Array.isArray(raw?.images) && raw.images.length > 0
            ? raw.images.map((im: any) => ({
                src: String(im?.src ?? im?.url ?? image ?? ""),
              }))
            : image
              ? [{ src: String(image) }]
              : [],
        variants: Array.isArray(raw?.variants)
          ? raw.variants.map((v: any) => ({
              id: v?.id ? String(v.id) : undefined,
              price: v?.price ?? v?.price_amount,
            }))
          : [],
        metafields: Array.isArray(raw?.metafields)
          ? raw.metafields.map((m: any) => ({
              key: String(m.key ?? ""),
              value: String(m.value ?? ""),
            }))
          : [],
      };

      return {
        _id: r._id ? String(r._id) : raw?.id ? String(raw.id) : undefined,
        shopifyId: r.shopifyId
          ? String(r.shopifyId)
          : raw?.id
            ? String(raw.id)
            : undefined,
        raw: rawSerializable,
        code: codeVal,
        title: rawSerializable.title ?? `Product ${i + 1}`,
        price,
        image,
        oems: oemsArr,
      };
    });

    const rawTitle = coll?.raw?.title ?? coll?.raw?.name ?? coll?.title ?? id;
    const cleanTitle = String(rawTitle).replace(/!/g, "");

    return (
      <>
        <div className="bg-[#f3f3f3] py-10">
          <div className="w-full max-w-[1540px]  px-6 md:px-27 mx-auto">
            <h1 className="font-bold text-center sm:text-start text-4xl md:text-5xl text-[#1f1f1f]">
              {cleanTitle}
            </h1>

            {/* breadcrumb + badge inside header */}
            <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-[#1f1f1f] font-semibold">Home</span>
                <span className="opacity-60">/</span>
                <span className="text-[#1f1f1f] font-semibold">
                  Collections
                </span>
                <span className="opacity-60">/</span>
                <span className="text-[#1f1f1f]">{cleanTitle}</span>
              </div>
              <Image
                className="sm:-mt-[5rem] mt-5"
                src="/tecdoc.png"
                alt="TecDoc Data Supplier"
                width={180}
                height={52}
                priority
              />
            </div>
          </div>
        </div>

        <main className="min-h-screen p-8">
          <div className="mx-auto sm:px-27 w-full max-w-[1540px] px-4 py-10">
            {products.length === 0 ? (
              <div className="w-full py-24 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold">
                  No products in this collection
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  This collection has no products yet.
                </p>
              </div>
            ) : (
              <CollectionProducts products={products} perPage={12} />
            )}
          </div>
        </main>
      </>
    );
  } catch (e) {
    console.error("Error loading collection", e);
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div>
          <h1 className="text-2xl font-bold">Error</h1>
          <p>Unable to load collection.</p>
        </div>
      </main>
    );
  }
}
