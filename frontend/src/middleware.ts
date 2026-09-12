import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Enterprise Next.js Edge Route Guard
 * Memverifikasi cookie HttpOnly 'access_token' sebelum merender halaman terproteksi.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";

  // 1. Jika rute admin diakses tanpa token -> redirect ke /login
  if (isAdminRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("redirect", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Jika halaman login diakses oleh user yang sudah punya token -> redirect ke dashboard admin
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL("/admin/monitoring", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
  ],
};
