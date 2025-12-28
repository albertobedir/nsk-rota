import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma/instance";

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
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: String(userId) } });
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
    };

    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    console.error("get-session error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
