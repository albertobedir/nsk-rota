/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Product from "@/schemas/mongoose/product";
import { validateImageUrls } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ValidatedImage {
  src: string;
  alt?: string | null;
  isValid: boolean;
}

/**
 * GET /api/products/[id]/validate-images
 * Validate all image URLs for a product and return their accessibility status
 *
 * Query params:
 * - timeout: Timeout per image in milliseconds (default: 5000ms)
 *
 * Response: { images: ValidatedImage[] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    console.log("[validate-images] Starting validation for product:", id);

    await connectDB();
    console.log("[validate-images] Connected to DB");

    const { searchParams } = new URL(req.url);
    const timeout = parseInt(searchParams.get("timeout") ?? "5000", 10);

    const productId = id;
    console.log(
      "[validate-images] Product ID:",
      productId,
      "Timeout:",
      timeout,
    );

    // Try to find product by shopifyId (numeric) or MongoDB ID
    let product: any = null;

    // Try numeric shopifyId first
    const numId = Number(productId);
    if (!isNaN(numId)) {
      console.log("[validate-images] Attempting to find by shopifyId:", numId);
      product = await Product.findOne({ shopifyId: numId }).lean();
      console.log("[validate-images] Found by shopifyId:", !!product);
    }

    // Fallback to MongoDB _id
    if (!product) {
      console.log(
        "[validate-images] Attempting to find by MongoDB _id:",
        productId,
      );
      try {
        product = await Product.findById(productId).lean();
        console.log("[validate-images] Found by _id:", !!product);
      } catch (idError) {
        console.warn("[validate-images] Invalid MongoDB ID:", idError);
      }
    }

    if (!product) {
      console.warn("[validate-images] Product not found:", productId);
      return NextResponse.json(
        { error: "Product not found", productId },
        { status: 404 },
      );
    }

    console.log("[validate-images] Product found, extracting images");

    // Extract image URLs from product
    const images: any[] = product.raw?.images ?? [];
    console.log("[validate-images] Total images:", images.length);

    if (images.length === 0) {
      console.log("[validate-images] No images found, returning empty array");
      return NextResponse.json({ images: [] });
    }

    // Get URLs to validate
    const urls = images.map((img: any) => img.src || img.url).filter(Boolean);

    console.log("[validate-images] URLs to validate:", urls);

    // Validate all URLs in parallel
    console.log("[validate-images] Starting image validation...");
    const validationMap = await validateImageUrls(urls, timeout);
    console.log("[validate-images] Validation complete");

    // Build response with validation status
    const validatedImages: ValidatedImage[] = images.map((img: any) => {
      const src = img.src || img.url;
      const isValid = validationMap.get(src) ?? false;
      console.log(
        `[validate-images] Image ${src}: ${isValid ? "valid" : "invalid"}`,
      );
      return {
        src,
        alt: img.alt,
        isValid,
      };
    });

    const validCount = validatedImages.filter((img) => img.isValid).length;
    console.log(
      `[validate-images] Valid images: ${validCount}/${validatedImages.length}`,
    );
    console.log("[validate-images] Response:", {
      images: validatedImages,
      validCount,
      totalCount: validatedImages.length,
    });

    return NextResponse.json({
      images: validatedImages,
      validCount,
      totalCount: validatedImages.length,
    });
  } catch (error) {
    console.error("[validate-images] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
