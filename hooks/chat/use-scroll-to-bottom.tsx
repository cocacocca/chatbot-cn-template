/** @file 滚动到底部 Hook，监听消息容器变化并自动跟随最新内容 */
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 滚动到底部 Hook
 *
 * 监听消息容器的滚动、内容变更与尺寸变化，在用户未主动上滑时
 * 自动保持视图停留在底部，同时暴露手动滚动与状态重置能力。
 *
 * @returns 容器 ref、底部锚点 ref、是否处于底部、滚动方法、视口进入/离开回调与重置方法
 */
export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 与 state 同步的 ref，便于在 Observer 回调中读取最新值
  const isAtBottomRef = useRef(true);
  // 标记用户是否正在主动滚动，避免自动滚动与用户操作冲突
  const isUserScrollingRef = useRef(false);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  /**
   * 判断容器当前是否滚动至底部（容差 100px）
   */
  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100;
  }, []);

  /**
   * 主动滚动容器到底部
   *
   * @param behavior 滚动行为，默认平滑滚动
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  // 监听用户滚动事件，更新底部状态并标记用户滚动中
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      // 用户停止滚动 150ms 后解除标记
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [checkIfAtBottom]);

  // 通过 Mutation/Resize Observer 在内容变化时自动跟随到底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scrollIfNeeded = () => {
      if (isAtBottomRef.current && !isUserScrollingRef.current) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "instant",
          });
          setIsAtBottom(true);
          isAtBottomRef.current = true;
        });
      }
    };

    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const resizeObserver = new ResizeObserver(scrollIfNeeded);
    resizeObserver.observe(container);

    for (const child of container.children) {
      resizeObserver.observe(child);
    }

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  /** 底部锚点进入视口时标记为已到底部 */
  function onViewportEnter() {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  }

  /** 底部锚点离开视口时标记为未到底部 */
  function onViewportLeave() {
    setIsAtBottom(false);
    isAtBottomRef.current = false;
  }

  /**
   * 重置滚动状态，恢复到底部跟随模式
   */
  const reset = useCallback(() => {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    isUserScrollingRef.current = false;
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
  };
}
