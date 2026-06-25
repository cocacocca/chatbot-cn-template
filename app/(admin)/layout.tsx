/** @file Admin 路由组布局：注入 Toaster 通知容器 */
import { Toaster } from "sonner";

/**
 * Admin 路由组布局组件
 * 为 admin 页面注入 Toaster（根布局未全局注入），并提供基础背景容器
 * @param props.children 子页面内容
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      {children}
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
    </div>
  );
}
