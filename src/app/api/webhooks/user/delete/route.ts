import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma/instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyWebhook(req: NextRequest, rawBody: string): boolean {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ────────────────────────────────────────────────────────────────
    // 1. HMAC verify
    // ────────────────────────────────────────────────────────────────
    if (!verifyShopifyWebhook(req, rawBody)) {
      console.warn("[🗑️ Customer Delete Webhook] Invalid HMAC signature");
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const customer = JSON.parse(rawBody);
    const { email, admin_graphql_api_id } = customer;
    console.log("[🗑️ Customer Delete Webhook] Received:", email);

    // ────────────────────────────────────────────────────────────────
    // 2. DB'den sil
    // ────────────────────────────────────────────────────────────────
    const dbUser = await prisma.user.findFirst({
      where: { shopifyCustomerId: admin_graphql_api_id },
    });

    if (!dbUser) {
      console.warn("[🗑️ Customer Delete Webhook] User not found in DB:", email);
      return NextResponse.json(
        { status: "not_found", message: "User not in database" },
        { status: 200 },
      );
    }

    await prisma.user.delete({ where: { id: dbUser.id } });
    console.log(
      "[✅ Customer Delete Webhook] User deleted from DB:",
      dbUser.id,
      email,
    );

    return NextResponse.json(
      { status: "ok", message: "User deleted from DB" },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[🗑️ Customer Delete Webhook] Critical error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
