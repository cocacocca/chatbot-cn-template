/** @file 移动端判定 Hook，基于视口宽度响应式识别移动设备 */
import { useEffect, useState } from "react";

/** 移动端断点：小于该宽度视为移动设备 */
const MOBILE_BREAKPOINT = 768;

/**
 * 移动端判定 Hook
 *
 * 通过 `matchMedia` 监听视口宽度变化，返回当前是否为移动端。
 * 首次渲染返回 `false`，避免 SSR 与客户端不一致。
 *
 * @returns 当前视口是否为移动端宽度
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
