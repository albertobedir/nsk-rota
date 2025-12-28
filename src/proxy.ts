import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // static & api dosyalarını atla
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/)
  ) {
    return NextResponse.next();
  }

  // App Router route'ları tam path olarak tanımlanmalı
  const auth_routes = ["/auth/login", "/auth/subscribe", "/auth/logout"];
  const protected_routes = ["/basket"];

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

  // Eğer kullanıcı login olmuşsa login sayfasına giremez
  if (is_auth_route && is_authenticated) {
    return NextResponse.redirect(new URL("/products", req.url));
  }

  // Login olmamış kullanıcı korumalı sayfaya girmeye çalışırsa login'e gönder
  if (is_protected_route && !is_authenticated) {
    const callback = pathname; // tekrar geri dönecek adres
    return NextResponse.redirect(
      new URL(`/auth/login?redirect=${callback}`, req.url)
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
