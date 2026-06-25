/**
 * @file Daily Digest Schedule
 * @description 每日 9:00 UTC 生成摘要
 * @module agent/schedules/daily-digest
 */

import { defineSchedule } from "eve/schedules";

/**
 * Daily Digest Schedule
 *
 * 周一到周五 9:00 UTC 运行，生成前一日活动摘要。
 * 采用 fire-and-forget 形式（markdown），由 Agent 接收 prompt 后自行执行。
 *
 * 注意：如需推送到具体 channel（如 Slack），需：
 * 1. 配置对应的 channel
 * 2. 改为 handler 形式：run({ receive, waitUntil, appAuth })
 * 3. 调用 receive(channel, { message, target: { channelId }, auth: appAuth })
 */
export default defineSchedule({
  cron: "0 9 * * 1-5",
  markdown: "Summarize yesterday's activity and post the digest.",
});
