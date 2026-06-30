/** @file EVE 工具：对已存在的 artifact 执行精确查找替换（find-and-replace）编辑。 */
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/ai/artifacts-db";

/**
 * edit_document EVE 工具。
 * 工具用途：对已有 artifact 进行小范围精确编辑，通过 old_string → new_string 的查找替换实现。
 *
 * 输入 schema：
 * - id: 待编辑 artifact 的 id
 * - old_string: 需被替换的精确字符串（建议包含 3-5 行上下文以保证唯一匹配）
 * - new_string: 替换后的字符串
 * - replace_all: 是否替换全部匹配（默认 false，仅替换首个）
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 ctx.session.auth.current.principalId）
 * 2. 校验 old_string 存在于文档内容中
 * 3. 执行替换并保存为新版本
 * 4. 返回包含编辑后完整内容的结构化数据
 *
 * @param args 工具输入，包含 id、old_string、new_string、replace_all
 * @param ctx EVE 工具上下文，用于获取 session 中的用户 id
 * @returns 包含 id、title、kind、content 的对象；失败时返回 error 字段
 */
export default defineTool({
  description:
    "Make a targeted edit to an existing artifact by finding and replacing an exact string. Preferred over updateDocument for small changes. The old_string must match exactly.",
  inputSchema: z.object({
    id: z.string().describe("The ID of the artifact to edit"),
    old_string: z
      .string()
      .describe(
        "Exact string to find. Include 3-5 surrounding lines for uniqueness."
      ),
    new_string: z.string().describe("Replacement string"),
    replace_all: z
      .boolean()
      .optional()
      .describe(
        "Replace all occurrences instead of just the first (default false)"
      ),
  }),
  async execute({ id, old_string, new_string, replace_all }, ctx) {
    const document = await getDocumentById(id);
    const userId = ctx.session.auth.current?.principalId;

    // 文档不存在
    if (!document) {
      return { error: "Document not found" };
    }

    // 权限校验：仅文档所有者可编辑
    if (document.userId !== userId) {
      return { error: "Forbidden" };
    }

    // 文档内容为空，无法执行查找替换
    if (!document.content) {
      return { error: "Document has no content" };
    }

    // 校验 old_string 在文档中存在
    if (!document.content.includes(old_string)) {
      return { error: "old_string not found in document" };
    }

    // 根据 replace_all 决定替换首个或全部匹配
    const updated = replace_all
      ? document.content.replaceAll(old_string, new_string)
      : document.content.replace(old_string, new_string);

    // 保存编辑后的内容（作为新版本写入数据库，仅已登录用户落库）
    if (userId) {
      await saveDocument({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: updated,
        userId: document.userId,
      });
    }

    return {
      id,
      title: document.title,
      kind: document.kind,
      content: updated,
    };
  },
});
