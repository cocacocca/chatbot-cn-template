/** @file Researcher Subagent 工具：使用 DuckDuckGo Instant Answer API 进行网络搜索。 */
import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * web_search 工具输入 schema。
 */
const inputSchema = z.object({
  query: z.string().describe("The search query"),
});

/**
 * DuckDuckGo Instant Answer API 响应结构（仅声明本工具关心的字段）。
 */
interface DuckDuckGoResponse {
  AbstractText?: string;
  Heading?: string;
  RelatedTopics?: Array<{ Text?: string }>;
}

/**
 * web_search 工具：使用 DuckDuckGo Instant Answer API 搜索信息。
 *
 * 调用 https://api.duckduckgo.com 的 Instant Answer 端点（无需 API key），
 * 返回摘要文本与最多 5 条相关主题。网络或解析失败时返回包含 error 字段
 * 的对象，不抛出异常，以保证 subagent 能继续运行。
 *
 * @param input.query 搜索查询字符串
 * @returns 成功时 { summary, relatedTopics }；失败时 { error }
 */
export default defineTool({
  description:
    "Search the web for information using DuckDuckGo. Returns a text summary and related topics.",
  inputSchema,
  async execute({ query }) {
    // 拼接查询参数：no_html=1 去除 HTML 标签，skip_disambig=1 跳过歧义页
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      // 网络异常（DNS/连接失败/超时）时返回 error，不抛出，让 agent 能继续
      return {
        error: `Search request failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }

    if (!response.ok) {
      return {
        error: `Search failed: ${response.status} ${response.statusText}`,
      };
    }

    let data: DuckDuckGoResponse;
    try {
      data = (await response.json()) as DuckDuckGoResponse;
    } catch (err) {
      return {
        error: `Search response parse failed: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }

    const summary = data.AbstractText || "No direct answer found.";
    const relatedTopics = (data.RelatedTopics ?? [])
      .map((t) => t.Text)
      .filter((t): t is string => typeof t === "string")
      .slice(0, 5);

    return { summary, relatedTopics };
  },
});
