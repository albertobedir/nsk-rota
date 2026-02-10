/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const { method } = req;
  const res = NextResponse.next();

  // Allow all origins (disable CORS restrictions)
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.headers.set("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  // static & api dosyalarını atla
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Public routes that should be accessible with or without session
  const public_routes = ["/add-member"];
  if (public_routes.includes(pathname)) {
    return NextResponse.next();
  }

  // App Router route'ları tam path olarak tanımlanmalı
  const auth_routes = ["/auth/login", "/auth/subscribe", "/auth/logout"];
  const protected_routes = [
    "/basket",
    "/profile",
    "/profile/account",
    "/profile/open-orders",
    "/profile/order-history",
    "/profile/invoices",
    "/profile/payment",
    "/orders",
    "/order-history",
    "/products",
    "/cart",
  ];

  const access_token = req.cookies.get("access_token")?.value ?? null;
  const refresh_token = req.cookies.get("refresh_token")?.value ?? null;

  /**
   * GERÇEK login kontrolü:
   * - sadece token varsa değil
   * - token decode edilebiliyor mu? (opsiyonel)
   * - token süresi geçmiş mi? (opsiyonel)
   */

  const is_authenticated = Boolean(access_token || refresh_token);

  const is_auth_route = auth_routes.includes(pathname);
  const is_protected_route = protected_routes.includes(pathname);

  if (is_auth_route && is_authenticated) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Eğer kullanıcı login olmamışsa, sadece auth sayfalarına erişebilir.
  // Herhangi bir başka sayfaya erişmeye çalışırsa login'e gönder.
  if (!is_authenticated && !is_auth_route) {
    const callback = pathname; // tekrar geri dönecek adres
    return NextResponse.redirect(
      new URL(`/auth/login?redirect=${callback}`, req.url),
    );
  }

  // --- User-specific Shopify metaobject sync (from middleware) ---
  const shouldSync =
    pathname.startsWith("/products/") ||
    pathname === "/products" ||
    pathname === "/cart";

  if (shouldSync) {
    const customerId = req.cookies.get("customer_id")?.value;
    if (customerId) {
      try {
        void fetch(new URL("/api/sync/user", req.nextUrl).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId }),
        });
      } catch (e) {
        console.error("proxy: failed to kick off user sync", e);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|png|svg|webp|gif|ico|woff2?|ttf)).*)",
  ],
};
