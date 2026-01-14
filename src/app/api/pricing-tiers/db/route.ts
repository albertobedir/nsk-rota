import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";

export async function GET(req: NextRequest) {
  try {
    const tiers = await prisma.pricingTier.findMany();
    return NextResponse.json({ ok: true, results: tiers });
  } catch (e) {
    console.error("/api/pricing-tiers/db error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
