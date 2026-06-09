import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "@/lib/constants";

// ── 路由分组 ──────────────────────────────────────────────
const AUTH_PAGES = new Set(["/login", "/register"]);
const PUBLIC_PREFIXES = ["/ping", "/api/auth"];

// ── 工具函数 ──────────────────────────────────────────────
function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function redirect(baseUrl: string, destination: string): NextResponse {
  return NextResponse.redirect(new URL(destination, baseUrl));
}

// ── 主代理 ────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 公开路由直接放行
  if (isPublic(pathname)) {
    if (pathname === "/ping") {
      return new Response("pong", { status: 200 });
    }
    return NextResponse.next();
  }

  // 2. 获取认证状态
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const isOnAuthPage = AUTH_PAGES.has(pathname);

  // 3. 已登录 → 访问认证页则重定向首页
  if (token) {
    if (isOnAuthPage) {
      return redirect(request.url, `${base}/`);
    }
    return NextResponse.next();
  }

  // 4. 未登录 → 访问认证页放行，其余重定向登录
  if (isOnAuthPage) {
    return NextResponse.next();
  }

  const loginUrl = new URL(`${base}/login`, request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

// ── 路由匹配 ──────────────────────────────────────────────
export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
