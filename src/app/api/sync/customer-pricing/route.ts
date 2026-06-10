import { NextRequest, NextResponse } from "next/server";
import { syncCustomerPricingToDatabase } from "@/lib/sync/customerPricingSync";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.SYNC_SECRET_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncCustomerPricingToDatabase();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ready" });
}
