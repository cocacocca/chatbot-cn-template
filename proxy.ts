import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/ping", "/login", "/register"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/ping") {
    return new NextResponse("pong", { status: 200 });
  }

  // 创建 response 对象，用于写回刷新的 session cookie
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 先写回 req.cookies，使后续 supabase.auth.getUser() 能读到刷新后的 session
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          // 同时写回 res.cookies，使 cookie 随响应返回浏览器
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 已登录访问 /login、/register → 重定向首页
  if (user && (pathname === "/login" || pathname === "/register")) {
    const redirectUrl = new URL("/", req.url);
    const redirectRes = NextResponse.redirect(redirectUrl);
    // 复制刷新的 cookie 到重定向 response，避免 session 丢失
    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value, c);
    }
    return redirectRes;
  }

  // 公开路由放行
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return res;
  }

  // 未登录访问受保护路由 → 重定向登录
  if (!user) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    const redirectRes = NextResponse.redirect(redirectUrl);
    // 复制刷新的 cookie 到重定向 response，避免 session 丢失
    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value, c);
    }
    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: ["/", "/chat/:id*", "/api/:path*", "/login", "/register"],
};
