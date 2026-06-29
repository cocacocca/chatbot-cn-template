/**
 * @file Skills 管理 API 路由
 * @description 提供 Skills 的增删改查接口，操作 agent/skills/ 目录下的文件
 *              支持 flat skill（单 .md 文件）和 packaged skill（目录 + SKILL.md）两种形态
 * @module api/admin/skills
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth/admin-guard";

/** Skills 目录的绝对路径 */
const SKILLS_DIR = join(process.cwd(), "agent", "skills");

/** packaged skill 目录内的入口文件名 */
const PACKAGED_ENTRY = "SKILL.md";

/** Skill 形态：flat 为单 .md 文件，packaged 为目录 + SKILL.md */
type SkillType = "flat" | "packaged";

/** GET 返回的单个 skill 项 */
type SkillItem = {
  id: string;
  type: SkillType;
  path: string;
  content: string;
  description: string;
};

/** POST 请求体 */
type CreateSkillRequest = {
  id: string;
  type: SkillType;
  content: string;
};

/** PUT 请求体 */
type UpdateSkillRequest = {
  id: string;
  type: SkillType;
  content: string;
};

/**
 * 文件名/目录名安全校验：仅允许小写字母、数字、连字符
 * 同时可防止路径穿越（拒绝 ../、/、大写、空格等）
 */
const ID_PATTERN = /^[a-z0-9-]+$/;

/** description 截断上限（字符数） */
const DESC_MAX_LENGTH = 80;

/**
 * 从 skill 内容中提取描述
 * 规则：若 frontmatter 含 description 字段则用之，否则取第一个非空非标题段落截断至 80 字符
 * @param content skill markdown 原文
 * @returns 提取出的描述字符串，无法提取时返回空串
 */
function extractDescription(content: string): string {
  let body = content;

  // 尝试匹配并剥离 frontmatter（YAML --- 包围块）
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    body = content.slice(fmMatch[0].length);
    const frontmatter = fmMatch[1];
    // 匹配 description: 后到行尾的内容（支持单双引号包裹）
    const descMatch = frontmatter.match(/^description:\s*(.+?)\s*$/m);
    if (descMatch) {
      let desc = descMatch[1].trim();
      // 去除首尾引号（单引号或双引号）
      if (
        (desc.startsWith('"') && desc.endsWith('"')) ||
        (desc.startsWith("'") && desc.endsWith("'"))
      ) {
        desc = desc.slice(1, -1);
      }
      return desc;
    }
  }

  // 按空行切分段落，找到第一个「非标题、非分隔线」段落
  const lines = body.split(/\r?\n/);
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      continue;
    }
    current.push(trimmed);
  }
  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }

  for (const paragraph of paragraphs) {
    // 跳过 ATX 标题（# / ## / ...）
    if (/^#+\s/.test(paragraph)) {
      continue;
    }
    // 跳过 Setext 标题下划线（=== 或 ---）
    if (/^[=-]{3,}$/.test(paragraph)) {
      continue;
    }
    // 命中第一个有效段落，截断到上限长度
    if (paragraph.length > DESC_MAX_LENGTH) {
      return `${paragraph.slice(0, DESC_MAX_LENGTH)}...`;
    }
    return paragraph;
  }

  return "";
}

/**
 * GET: 读取 skills 目录，返回所有 flat / packaged skills
 * 目录不存在时返回空列表（首次使用时 agent/skills 可能尚未创建）
 * @returns 200 { skills: SkillItem[] } / 401 未授权 / 500 服务器错误
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 目录不存在时返回空列表
    try {
      await fs.access(SKILLS_DIR);
    } catch {
      return Response.json({ skills: [] });
    }

    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });

    // 分别收集 flat 与 packaged 候选项，避免 await in loop
    const flatEntries = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".md")
    );
    const packagedEntries = entries.filter((entry) => entry.isDirectory());

    // 并发读取 flat skills
    const flatSkills = await Promise.all(
      flatEntries.map(async (entry): Promise<SkillItem> => {
        const fullPath = join(SKILLS_DIR, entry.name);
        const content = await fs.readFile(fullPath, "utf-8");
        const id = entry.name.slice(0, -3); // 移除 .md 扩展名
        return {
          id,
          type: "flat",
          path: `agent/skills/${entry.name}`,
          content,
          description: extractDescription(content),
        };
      })
    );

    // 并发读取 packaged skills（仅当目录内存在 SKILL.md 时纳入）
    const packagedSkills = await Promise.all(
      packagedEntries.map(async (entry): Promise<SkillItem | null> => {
        const entryPath = join(SKILLS_DIR, entry.name, PACKAGED_ENTRY);
        try {
          await fs.access(entryPath);
        } catch {
          // 目录内无 SKILL.md，跳过
          return null;
        }
        const content = await fs.readFile(entryPath, "utf-8");
        return {
          id: entry.name,
          type: "packaged",
          path: `agent/skills/${entry.name}/${PACKAGED_ENTRY}`,
          content,
          description: extractDescription(content),
        };
      })
    );

    const skills = [...flatSkills, ...packagedSkills].filter(
      (item): item is SkillItem => item !== null
    );

    return Response.json({ skills });
  } catch (_error) {
    return Response.json({ error: "Failed to read skills" }, { status: 500 });
  }
}

/**
 * POST: 创建新 skill
 * 根据 type 写入 agent/skills/<id>.md（flat）或 agent/skills/<id>/SKILL.md（packaged）
 * @param request CreateSkillRequest 请求体（id + type + content）
 * @returns 201 创建成功 / 400 参数缺失或非法 / 401 未授权 / 409 已存在 / 500 服务器错误
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreateSkillRequest;
    const { id, type, content } = body;

    // 参数校验
    if (!id || !type || typeof content !== "string") {
      return Response.json(
        { error: "id, type, content are required" },
        { status: 400 }
      );
    }
    if (type !== "flat" && type !== "packaged") {
      return Response.json(
        { error: "type must be 'flat' or 'packaged'" },
        { status: 400 }
      );
    }
    if (!ID_PATTERN.test(id)) {
      return Response.json(
        {
          error: "id must contain only lowercase letters, digits, or hyphens",
        },
        { status: 400 }
      );
    }

    // 确保目录存在
    await fs.mkdir(SKILLS_DIR, { recursive: true });

    if (type === "flat") {
      const filePath = join(SKILLS_DIR, `${id}.md`);
      // 检查文件是否已存在
      try {
        await fs.access(filePath);
        return Response.json(
          { error: `Skill '${id}' already exists` },
          { status: 409 }
        );
      } catch {
        // 文件不存在，继续创建
      }
      await fs.writeFile(filePath, content, "utf-8");

      return Response.json(
        {
          skill: {
            id,
            type,
            path: `agent/skills/${id}.md`,
            content,
            description: extractDescription(content),
          },
        },
        { status: 201 }
      );
    }

    // packaged: 目录 + SKILL.md
    const dirPath = join(SKILLS_DIR, id);
    const entryPath = join(dirPath, PACKAGED_ENTRY);
    try {
      await fs.access(dirPath);
      return Response.json(
        { error: `Skill '${id}' already exists` },
        { status: 409 }
      );
    } catch {
      // 目录不存在，继续创建
    }
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(entryPath, content, "utf-8");

    return Response.json(
      {
        skill: {
          id,
          type,
          path: `agent/skills/${id}/${PACKAGED_ENTRY}`,
          content,
          description: extractDescription(content),
        },
      },
      { status: 201 }
    );
  } catch (_error) {
    return Response.json({ error: "Failed to create skill" }, { status: 500 });
  }
}

/**
 * PUT: 更新 skill 内容
 * 根据 type 覆盖 flat 文件或 packaged 入口文件
 * @param request UpdateSkillRequest 请求体（id + type + content）
 * @returns 200 更新成功 / 400 参数缺失 / 401 未授权 / 404 文件不存在 / 500 服务器错误
 */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as UpdateSkillRequest;
    const { id, type, content } = body;

    if (!id || !type || typeof content !== "string") {
      return Response.json(
        { error: "id, type, content are required" },
        { status: 400 }
      );
    }
    if (type !== "flat" && type !== "packaged") {
      return Response.json(
        { error: "type must be 'flat' or 'packaged'" },
        { status: 400 }
      );
    }
    if (!ID_PATTERN.test(id)) {
      return Response.json(
        {
          error: "id must contain only lowercase letters, digits, or hyphens",
        },
        { status: 400 }
      );
    }

    if (type === "flat") {
      const filePath = join(SKILLS_DIR, `${id}.md`);
      try {
        await fs.access(filePath);
      } catch {
        return Response.json(
          { error: `Skill '${id}' not found` },
          { status: 404 }
        );
      }
      await fs.writeFile(filePath, content, "utf-8");

      return Response.json({
        skill: {
          id,
          type,
          path: `agent/skills/${id}.md`,
          content,
          description: extractDescription(content),
        },
      });
    }

    // packaged
    const entryPath = join(SKILLS_DIR, id, PACKAGED_ENTRY);
    try {
      await fs.access(entryPath);
    } catch {
      return Response.json(
        { error: `Skill '${id}' not found` },
        { status: 404 }
      );
    }
    await fs.writeFile(entryPath, content, "utf-8");

    return Response.json({
      skill: {
        id,
        type,
        path: `agent/skills/${id}/${PACKAGED_ENTRY}`,
        content,
        description: extractDescription(content),
      },
    });
  } catch (_error) {
    return Response.json({ error: "Failed to update skill" }, { status: 500 });
  }
}

/**
 * DELETE: 删除指定 skill
 * flat 删除 .md 文件；packaged 递归删除整个目录
 * @param request 通过 query 参数 id 与 type 指定要删除的 skill
 * @returns 200 删除成功 / 400 缺少参数 / 401 未授权 / 404 不存在 / 500 服务器错误
 */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id || !type) {
    return Response.json(
      { error: "id and type are required" },
      { status: 400 }
    );
  }
  if (type !== "flat" && type !== "packaged") {
    return Response.json(
      { error: "type must be 'flat' or 'packaged'" },
      { status: 400 }
    );
  }
  if (!ID_PATTERN.test(id)) {
    return Response.json(
      {
        error: "id must contain only lowercase letters, digits, or hyphens",
      },
      { status: 400 }
    );
  }

  try {
    if (type === "flat") {
      const filePath = join(SKILLS_DIR, `${id}.md`);
      await fs.unlink(filePath);
      return Response.json({ success: true });
    }

    // packaged: 递归删除目录（force: true 在目录不存在时不抛错，由 404 兜底）
    const dirPath = join(SKILLS_DIR, id);
    // 先校验目录存在，避免误判 success
    try {
      await fs.access(dirPath);
    } catch {
      return Response.json(
        { error: `Skill '${id}' not found` },
        { status: 404 }
      );
    }
    await fs.rm(dirPath, { recursive: true, force: true });
    return Response.json({ success: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json(
        { error: `Skill '${id}' not found` },
        { status: 404 }
      );
    }
    return Response.json({ error: "Failed to delete skill" }, { status: 500 });
  }
}
