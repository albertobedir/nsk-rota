/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Authenticated endpoint to trigger customer pricing sync from the client
 * Requires valid JWT token in cookies
 */
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { syncCustomerPricingToDatabase } from "@/lib/sync/customerPricingSync";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const token = req.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: any = null;
    try {
      payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Trigger sync
    const result = await syncCustomerPricingToDatabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[customer/sync-pricing] error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ready" });
}
