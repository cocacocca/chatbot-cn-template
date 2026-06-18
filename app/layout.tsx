/** @file 应用根布局：设置字体、主题、元数据，并注入主题色同步脚本 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SWRProvider } from "@/components/providers/swr-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

/** 站点元数据：标题与描述 */
export const metadata: Metadata = {
  title: "AI Chatbot",
  description: "AI chatbot using the Vercel AI SDK.",
};

/** 视口配置：禁用用户缩放，保证移动端布局稳定 */
export const viewport = {
  maximumScale: 1,
};

/** Geist 无衬线字体，挂载到 --font-geist 变量 */
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

/** Geist 等宽字体，挂载到 --font-geist-mono 变量 */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

/** 亮色主题的 theme-color 值 */
const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
/** 暗色主题的 theme-color 值 */
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
/**
 * 主题色同步脚本：监听 <html> class 变化，动态更新 <meta name="theme-color">，
 * 使浏览器地址栏/状态栏颜色与当前主题保持一致。需在 hydration 前执行以避免闪烁。
 */
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

/**
 * 根布局组件
 * 设置语言为 zh-CN，挂载字体变量，注入主题色脚本，
 * 并依次包裹 ThemeProvider、SWRProvider、TooltipProvider。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      lang="zh-CN"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <SWRProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
