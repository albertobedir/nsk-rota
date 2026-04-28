/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma/instance";
import { computeTier } from "@/lib/utils/tier";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: any = null;
    try {
      payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
    });
    if (!user) return NextResponse.json({ user: null });

    // format credit fields as numbers for client session
    const safeNumber = (v: any) => {
      try {
        if (v == null) return 0;
        const n = Number(String(v));
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    };

    // normalize shopify tags (stored as JSON or comma string)
    const normalizeTags = (raw: any) => {
      try {
        if (!raw) return [];
        if (Array.isArray(raw))
          return raw.map((s) => String(s).trim()).filter(Boolean);
        if (typeof raw === "string")
          return String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return [];
      } catch {
        return [];
      }
    };

    const tagsArray = normalizeTags(user.shopifyTags ?? null);

    const inferredTier = computeTier(tagsArray);

    // Fallback: derive shopifyCustomerId from billingAddress if not set
    let shopifyCustomerId = user.shopifyCustomerId;
    if (
      !shopifyCustomerId &&
      user.billingAddress &&
      typeof user.billingAddress === "object" &&
      "customer_id" in user.billingAddress
    ) {
      const billingCustomerId = (user.billingAddress as any).customer_id;
      if (billingCustomerId) {
        shopifyCustomerId = `gid://shopify/Customer/${billingCustomerId}`;

        // Save in background (fire & forget)
        prisma.user
          .update({
            where: { id: user.id },
            data: { shopifyCustomerId },
          })
          .catch((err) =>
            console.warn(
              "[get-session] Failed to save shopifyCustomerId:",
              err,
            ),
          );
      }
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      customerCode: user.customerCode,
      deliveryTerms: user.deliveryTerms,
      paymentTerms: user.paymentTerms,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      zip: user.zip,
      billingAddress: user.billingAddress,
      shippingAddress: user.shippingAddress,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      creditLimit: safeNumber(user.creditLimit),
      creditUsed: safeNumber(user.creditUsed),
      creditRemaining: safeNumber(user.creditRemaining),
      // Shopify customer ID + tags + inferred tier for client
      shopifyCustomerId: shopifyCustomerId ?? null,
      tags: tagsArray,
      tier: user.tier ?? inferredTier ?? null,
      // Company information
      companyName: user.companyName ?? null,
      shopifyCompanyId: user.shopifyCompanyId ?? null,
      companyAddress1: user.companyAddress1 ?? null,
      companyCity: user.companyCity ?? null,
      companyState: user.companyState ?? null,
      companyZip: user.companyZip ?? null,
    };

    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    console.error("get-session error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
