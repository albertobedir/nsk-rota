import { NextResponse } from "next/server";

const AUTH_COOKIES = [
  "access_token",
  "refresh_token",
  "refreshToken", // alias used in some places
  "shopifyAccessToken",
  "customer_id",
  "shopifyCartId",
];

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });

  for (const name of AUTH_COOKIES) {
    res.cookies.set(name, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return res;
}
