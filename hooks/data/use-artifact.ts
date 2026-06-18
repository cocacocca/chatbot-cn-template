/** @file Artifact 状态 Hook，基于 SWR 管理文档工件及其元数据 */
"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { UIArtifact } from "@/components/chat/artifact";

/** Artifact 初始空状态，未加载时使用的占位数据 */
export const initialArtifactData: UIArtifact = {
  documentId: "init",
  content: "",
  kind: "text",
  title: "",
  status: "idle",
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

/** 选择器类型：从 Artifact 状态中派生出局部字段 */
type Selector<T> = (state: UIArtifact) => T;

/**
 * Artifact 选择器 Hook
 *
 * 仅订阅 Artifact 状态的局部字段，避免无关字段变更引发的重渲染。
 *
 * @param selector 派生函数，接收当前 Artifact 状态并返回所需字段
 * @returns 派生后的字段值
 */
export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  const { data: localArtifact } = useSWR<UIArtifact>("artifact", null, {
    fallbackData: initialArtifactData,
  });

  const selectedValue = useMemo(() => {
    if (!localArtifact) {
      return selector(initialArtifactData);
    }
    return selector(localArtifact);
  }, [localArtifact, selector]);

  return selectedValue;
}

/**
 * Artifact 状态 Hook
 *
 * 提供当前 Artifact 的读取与更新方法，同时管理与之绑定的元数据。
 * 元数据 SWR key 随 documentId 变化，切换文档时自动重新加载。
 *
 * @returns Artifact 状态、更新方法、元数据及其更新方法
 */
export function useArtifact() {
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    "artifact",
    null,
    {
      fallbackData: initialArtifactData,
    }
  );

  const artifact = useMemo(() => {
    if (!localArtifact) {
      return initialArtifactData;
    }
    return localArtifact;
  }, [localArtifact]);

  /**
   * 更新 Artifact 状态
   *
   * @param updaterFn 新状态对象或基于当前状态返回新状态的函数
   */
  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((currentArtifact) => {
        const artifactToUpdate = currentArtifact || initialArtifactData;

        if (typeof updaterFn === "function") {
          return updaterFn(artifactToUpdate);
        }

        return updaterFn;
      });
    },
    [setLocalArtifact]
  );

  // 元数据 key 依赖 documentId，文档切换时自动失效并重新拉取
  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } =
    useSWR<any>(
      () =>
        artifact.documentId ? `artifact-metadata-${artifact.documentId}` : null,
      null,
      {
        fallbackData: null,
      }
    );

  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata: localArtifactMetadata,
      setMetadata: setLocalArtifactMetadata,
    }),
    [artifact, setArtifact, localArtifactMetadata, setLocalArtifactMetadata]
  );
}
