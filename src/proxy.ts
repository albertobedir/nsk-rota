import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ttf)$/)
  ) {
    return NextResponse.next();
  }

  const access_token = req.cookies.get("accessToken");
  const refresh_token = req.cookies.get("refreshToken");

  const is_auth_route =
    pathname.startsWith("/auth") && pathname !== "/auth/logout";
  const is_public_route =
    pathname === "/" || is_auth_route || pathname === "/_not-found";

  if (!is_public_route && !access_token) {
    if (refresh_token) {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  if (is_auth_route && refresh_token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
