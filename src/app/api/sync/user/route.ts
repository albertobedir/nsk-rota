import { NextResponse } from "next/server";
import syncUserMetaobjects from "@/lib/sync/syncUserMetaobjects";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerId = body?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "No customerId" },
        { status: 400 }
      );
    }

    // Run sync in background and return immediately so callers (middleware) stay fast.
    void syncUserMetaobjects({ customerId }).catch((err) => {
      console.error("/api/sync/user background sync failed:", err);
    });

    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (err) {
    console.error("/api/sync/user error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
