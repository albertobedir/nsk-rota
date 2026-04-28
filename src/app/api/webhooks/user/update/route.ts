/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import crypto from "crypto";

export const runtime = "nodejs";

function verifyWebhook(body: string, hmac: string, secret: string): boolean {
  const computed = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  const a = Buffer.from(computed, "base64");
  const b = Buffer.from(hmac, "base64");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fetchCustomerMetafieldsREST(customerId: string) {
  const token =
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ??
    process.env.SHOPIFY_ADMIN_API_TOKEN ??
    "";
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  if (!token || !shop) return [];

  const url = `https://${shop}/admin/api/2024-10/customers/${customerId}/metafields.json`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json();
  return json.metafields || [];
}

async function fetchCustomerTagsREST(customerId: string) {
  const token =
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ??
    process.env.SHOPIFY_ADMIN_API_TOKEN ??
    "";
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  if (!token || !shop) return [];

  const url = `https://${shop}/admin/api/2024-10/customers/${customerId}.json?fields=tags`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json();
  const tagsStr = json?.customer?.tags ?? "";
  if (!tagsStr) return [];
  // Shopify returns tags as comma-separated string
  return tagsStr
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";

    if (
      !hmac ||
      !verifyWebhook(body, hmac, process.env.SHOPIFY_WEBHOOK_SECRET ?? "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customer = JSON.parse(body);
    // Debug logs: raw body and parsed payload for troubleshooting metafield updates
    console.log("[webhook:user:update] raw body:", body);
    try {
      console.log(
        "[webhook:user:update] parsed customer:",
        JSON.stringify(customer),
      );
    } catch {
      console.log("[webhook:user:update] parsed customer (non-serializable)");
    }

    const metafields = await fetchCustomerMetafieldsREST(customer.id);
    console.log(
      "[webhook:user:update] fetched metafields:",
      Array.isArray(metafields) ? metafields.length : typeof metafields,
    );
    try {
      console.log(JSON.stringify(metafields));
    } catch {
      /* ignore */
    }

    // extract metafield values
    const getField = (key: string) => {
      const f = metafields.find((m: any) => m.key === key);
      return f ? f.value : undefined;
    };

    const customerCode = getField("customer_code");
    const deliveryTerms = getField("delivery_terms");
    const paymentTerms = getField("payment_terms");
    const creditLimit = getField("credit_limit");
    const creditUsed = getField("credit_used");
    const creditRemainingMeta = getField("credit_remaining");

    // Shopify money metafields are returned as JSON strings like
    // {"amount":"210000.0","currency_code":"USD"}
    const parseMoneyAmount = (v: unknown) => {
      if (v == null) return 0;
      // already an object
      if (typeof v === "object") {
        try {
          const anyv: any = v as any;
          if (anyv.amount != null) return Number(anyv.amount) || 0;
        } catch {
          return 0;
        }
      }
      const s = String(v).trim();
      if (!s) return 0;
      // try JSON parse
      if (s.startsWith("{")) {
        try {
          const obj = JSON.parse(s);
          if (obj && obj.amount != null) return Number(obj.amount) || 0;
        } catch {
          // fallthrough
        }
      }
      // fallback to numeric parse
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const creditLimitNum = parseMoneyAmount(creditLimit);
    const creditUsedNum = parseMoneyAmount(creditUsed);
    const creditRemainingNum =
      parseMoneyAmount(creditRemainingMeta) ||
      Math.max(0, creditLimitNum - creditUsedNum);

    console.log("[webhook:user:update] computed credit amounts:", {
      creditLimitNum,
      creditUsedNum,
      creditRemainingNum,
    });

    console.log("[webhook:user:update] extracted metafield values:", {
      customerCode,
      deliveryTerms,
      paymentTerms,
      creditLimit,
      creditUsed,
    });

    // Fetch tags (either provided in payload or via admin REST)
    let tags: string[] = [];
    try {
      if (customer.tags && Array.isArray(customer.tags)) tags = customer.tags;
      else if (typeof customer.tags === "string")
        tags = String(customer.tags)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      else {
        tags = await fetchCustomerTagsREST(customer.id);
      }
    } catch (e) {
      console.warn("Failed to fetch/parse customer tags:", e);
      tags = [];
    }

    // Debug: log raw tags
    console.log("[webhook:user:update] customer tags raw:", tags);

    // Compute tier based on tags (robust/normalized matching)
    const computeTier = (tgs: string[] = []) => {
      try {
        if (!tgs || tgs.length === 0) return null;
        const normalized = tgs
          .map((s: any) =>
            String(s ?? "")
              .toLowerCase()
              .trim(),
          )
          .map((s) => s.replace(/[_\s]+/g, "-"));

        // match variants like 'tier-3', 'tier 3', 'tier3', 'Tier-3', etc.
        if (normalized.some((s) => /tier[-]?3$/.test(s) || s === "tier3"))
          return "tier-3";
        if (normalized.some((s) => /tier[-]?2$/.test(s) || s === "tier2"))
          return "tier-2";
        return null;
      } catch {
        return null;
      }
    };

    const tierTag = computeTier(tags);
    console.log("[webhook:user:update] computed tier:", tierTag);

    const defaultAddress = customer.default_address ?? null;

    // Extract company information from metafields
    const companyName = getField("company_name");
    const shopifyCompanyId = customer.company_id ?? null; // May come from payload directly

    // helper to produce a Decimal-compatible string for Prisma Decimal fields
    const toDecimalString = (v: unknown) => {
      const n = Number(String(v ?? "").trim());
      if (Number.isFinite(n)) return n.toFixed(2);
      return "0.00";
    };

    // Upsert into User model (email is unique)
    const email = customer.email ?? "";
    if (!email) {
      console.warn(
        "Webhook: customer has no email, skipping user upsert",
        customer.id,
      );
      return NextResponse.json({ success: true });
    }

    await prisma.user.upsert({
      where: { email },
      update: {
        name:
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
          null,
        firstName: customer.first_name ?? null,
        lastName: customer.last_name ?? null,
        phone: customer.phone ?? null,
        emailVerified: customer.verified_email ? new Date() : null,
        updatedAt: new Date(),
        customerCode: customerCode ?? null,
        deliveryTerms: deliveryTerms ?? null,
        paymentTerms: paymentTerms ?? null,
        addressLine1: defaultAddress?.address1 ?? null,
        addressLine2: defaultAddress?.address2 ?? null,
        city: defaultAddress?.city ?? null,
        zip: defaultAddress?.zip ?? null,
        billingAddress: defaultAddress ?? null,
        shippingAddress: defaultAddress ?? null,
        creditLimit: toDecimalString(creditLimitNum),
        creditUsed: toDecimalString(creditUsedNum),
        creditRemaining: toDecimalString(creditRemainingNum),
        shopifyTags: tags,
        tier: tierTag ?? null,
        companyName: companyName ?? null,
        shopifyCompanyId: shopifyCompanyId ?? null,
      },
      create: {
        email,
        name:
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
          null,
        firstName: customer.first_name ?? null,
        lastName: customer.last_name ?? null,
        phone: customer.phone ?? null,
        password: "",
        emailVerified: customer.verified_email ? new Date() : null,
        customerCode: customerCode ?? null,
        deliveryTerms: deliveryTerms ?? null,
        paymentTerms: paymentTerms ?? null,
        addressLine1: defaultAddress?.address1 ?? null,
        addressLine2: defaultAddress?.address2 ?? null,
        city: defaultAddress?.city ?? null,
        zip: defaultAddress?.zip ?? null,
        billingAddress: defaultAddress ?? null,
        shippingAddress: defaultAddress ?? null,
        creditLimit: toDecimalString(creditLimitNum),
        creditUsed: toDecimalString(creditUsedNum),
        creditRemaining: toDecimalString(creditRemainingNum),
        shopifyTags: tags,
        tier: tierTag ?? null,
        companyName: companyName ?? null,
        shopifyCompanyId: shopifyCompanyId ?? null,
      },
    });

    // Also upsert into prisma.Customer for shopify-specific record tracking
    try {
      await prisma.customer.upsert({
        where: { shopifyId: String(customer.id) },
        update: {
          email: email,
          firstName: customer.first_name ?? null,
          lastName: customer.last_name ?? null,
          phone: customer.phone ?? null,
          creditLimit: creditLimitNum
            ? toDecimalString(creditLimitNum)
            : undefined,
          creditUsed: creditUsedNum
            ? toDecimalString(creditUsedNum)
            : undefined,
          creditRemaining: creditRemainingNum
            ? toDecimalString(creditRemainingNum)
            : undefined,
          updatedAt: new Date(),
        },
        create: {
          shopifyId: String(customer.id),
          email: email,
          firstName: customer.first_name ?? null,
          lastName: customer.last_name ?? null,
          phone: customer.phone ?? null,
          creditLimit: creditLimitNum
            ? toDecimalString(creditLimitNum)
            : undefined,
          creditUsed: creditUsedNum
            ? toDecimalString(creditUsedNum)
            : undefined,
          creditRemaining: creditRemainingNum
            ? toDecimalString(creditRemainingNum)
            : undefined,
        },
      });
    } catch (e) {
      console.warn("Failed to upsert prisma.Customer:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
