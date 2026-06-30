/** @file React 组件渲染适配器：在 ProseMirror 节点视图中挂载/卸载 React 组件 */
import { createRoot } from "react-dom/client";

/**
 * 将 React 组件渲染到指定 DOM 节点，并返回销毁句柄
 * 典型场景：ProseMirror 的 NodeView 需要嵌入 React 组件时使用
 * @param component 待渲染的 React 元素
 * @param dom 挂载目标 DOM 节点
 * @returns 包含 destroy 方法的对象，调用即卸载组件
 */
export function renderReactComponent(
  component: React.ReactElement,
  dom: HTMLElement
) {
  const root = createRoot(dom);
  root.render(component);

  return {
    destroy: () => root.unmount(),
  };
}
