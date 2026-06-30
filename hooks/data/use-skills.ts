/** @file Skills 列表 Hook，基于 SWR 拉取 agent/skills 目录下的 skill 文件 */
"use client";

import useSWR from "swr";

/** Skill 形态：flat 为单 .md 文件，packaged 为目录 + SKILL.md */
export type SkillType = "flat" | "packaged";

/** GET 接口返回的单个 skill 项 */
export type SkillItem = {
  id: string;
  type: SkillType;
  path: string;
  content: string;
  description: string;
};

/** GET 接口响应 */
type SkillsResponse = {
  skills: SkillItem[];
};

/** POST 请求体 */
export type CreateSkillRequest = {
  id: string;
  type: SkillType;
  content: string;
};

/** PUT 请求体 */
export type UpdateSkillRequest = {
  id: string;
  type: SkillType;
  content: string;
};

/** Skills SWR key，固定指向 /api/admin/skills */
export const SKILLS_SWR_KEY = "/api/admin/skills";

/**
 * Skills 专用 fetcher：ok 返回 json，失败抛错
 * 错误响应格式与 API route 一致（{ error: string }）
 * @param url 请求地址
 * @returns 解析后的 SkillsResponse
 */
async function skillsFetcher(url: string): Promise<SkillsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({
      error: "请求失败",
    }))) as { error?: string };
    throw new Error(data.error ?? "请求失败");
  }
  return (await res.json()) as SkillsResponse;
}

/**
 * Skills 列表 Hook
 * 拉取后端 skill 文件列表，返回数据、加载状态、错误及 mutate 方法
 * @returns skills 列表、isLoading、error、mutate
 */
export function useSkills() {
  const { data, error, isLoading, mutate } = useSWR<SkillsResponse>(
    SKILLS_SWR_KEY,
    skillsFetcher,
    { revalidateOnFocus: false }
  );

  const skills = data?.skills ?? [];

  return {
    skills,
    isLoading,
    error,
    mutate,
  };
}
