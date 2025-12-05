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

   const auth_routes = ["/login", "/subscribe", "/logout"];
   const protected_routes = ["/basket"];

   const access_token = req.cookies.get("access_token");
   const refresh_token = req.cookies.get("refresh_token");

   const is_authenticated = !!access_token || !!refresh_token; // this is not correct, we need to check if the token is valid

   const is_auth_route = auth_routes.includes(pathname);
   const is_protected_route = protected_routes.includes(pathname);
   // const is_public_route = !is_protected_route;

   if (is_auth_route && is_authenticated) {
      return NextResponse.redirect(new URL("/", req.url));
   }

   if (is_protected_route && !is_authenticated) {
      const callback_url = req.nextUrl.pathname;
      return NextResponse.redirect(
         new URL(`/login?callback=${callback_url}`, req.url)
      );
   }

   return NextResponse.next();
}

export const config = {
   matcher: [
      "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
   ],
};
