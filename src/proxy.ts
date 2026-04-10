import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side refresh token helper
 * Eğer access_token yok ama refresh_token varsa, yeni token'lar almaya çalış
 */
async function tryRefreshToken(
  req: NextRequest,
  refreshToken: string,
): Promise<{ accessToken?: string; refreshToken?: string } | null> {
  try {
    // Normalize base URL: eğer /api ile bitiyorsa kaldır
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    baseUrl = baseUrl.replace(/\/api\/?$/, "");

    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `refresh_token=${refreshToken}`,
      },
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    }
  } catch (e) {
    console.error("middleware: refresh token failed", e);
  }

  return null;
}

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

  // Public routes that should be accessible with or without session
  const is_add_member_route =
    pathname === "/add-member" || pathname.startsWith("/add-member/");
  if (is_add_member_route) {
    return NextResponse.next();
  }

  // App Router route'ları tam path olarak tanımlanmalı
  const auth_routes = ["/auth/login", "/auth/subscribe", "/auth/logout"];
  const protected_routes = [
    "/",
    "/basket",
    "/profile",
    "/profile/account",
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

  const is_authenticated = Boolean(access_token);
  const has_refresh_token = Boolean(refresh_token);

  const is_auth_route = auth_routes.includes(pathname);
  const is_protected_route = protected_routes.includes(pathname);

  // 1️⃣ Auth route'a giriş: authenticated kullanıcı login page'e gitmesin
  if (is_auth_route && is_authenticated) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 2️⃣ Protected route'a giriş: token refresh denemesi yap
  if (is_protected_route && !is_authenticated) {
    if (has_refresh_token && refresh_token) {
      // Async işlem sırasında middleware'i bekletebilmek için
      // refresh token denemesini burada yap
      return (async () => {
        const refreshed = await tryRefreshToken(req, refresh_token);

        if (refreshed?.accessToken && refreshed?.refreshToken) {
          // Başarılı refresh: yeni token'ları set et ve protected route'a gidebilir
          const res = NextResponse.next();
          res.cookies.set("access_token", refreshed.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
          res.cookies.set("refresh_token", refreshed.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30 days
          });
          return res;
        } else {
          // Refresh başarısız: login'e yönlendir
          return NextResponse.redirect(new URL(`/auth/login`, req.url));
        }
      })();
    } else {
      // refresh_token da yok: login'e yönlendir
      return NextResponse.redirect(new URL(`/auth/login`, req.url));
    }
  }

  // 3️⃣ Non-authenticated + Non-protected: izin ver
  if (!is_authenticated && !is_auth_route && !is_protected_route) {
    return NextResponse.next();
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
