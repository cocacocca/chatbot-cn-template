/**
 * @file Heartbeat Schedule
 * @description 每 5 分钟检查系统状态，确保 Agent 正常运行
 * @module agent/schedules/heartbeat
 */

import { defineSchedule } from "eve/schedules";

/**
 * Heartbeat Schedule
 *
 * 每 5 分钟运行一次，检查系统状态。
 * 这是一个 fire-and-forget schedule，Agent 接收 prompt 后自行执行。
 */
export default defineSchedule({
  cron: "*/5 * * * *",
  markdown:
    "Check system status and report any issues. Verify database connectivity and API endpoints are responding.",
});
