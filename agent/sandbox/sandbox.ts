/**
 * @file EVE Sandbox 配置
 * @description 定义 Agent 的隔离 bash 环境，配置后端、网络策略和初始化脚本
 *
 *   设计要点：
 *   - networkPolicy: "deny-all" 是最安全的默认策略，禁止 Sandbox 内任何网络出站
 *   - bootstrap 不再执行 apt-get install：deny-all 下 apt-get 无法联网下载包，
 *     且项目实际未使用 jq（搜索全仓无 jq 调用），安装步骤纯属浪费 template 构建时间
 *   - onSession 仅写入 SESSION_USER.txt，无网络需求，与 deny-all 兼容
 *   - 如未来需要安装系统包，需在此处临时 setNetworkPolicy({ allow: true }) 后再安装
 *
 * @module agent/sandbox/sandbox
 */

import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Sandbox 定义
 *
 * 使用 Vercel Sandbox 后端，提供隔离的 bash 环境。
 * - 默认网络策略：deny-all（禁止所有网络访问）
 * - bootstrap：template-scoped，运行一次（当前无初始化任务）
 * - onSession：session-scoped，每个 session 运行一次，写入用户信息
 *
 * Sandbox Handle API：
 * - run({ command }) - 运行命令
 * - writeTextFile({ path, content }) - 写入文件
 * - readTextFile({ path }) - 读取文件
 * - removePath({ path, force, recursive }) - 删除文件
 * - setNetworkPolicy({ allow, subnets }) - 修改网络策略
 */
export default defineSandbox({
  // 使用 Vercel Sandbox 后端
  backend: vercel({
    runtime: "node24",
    resources: { vcpus: 2 },
    networkPolicy: "deny-all",
  }),

  // Revalidation key：决定何时重建 template
  revalidationKey: () => "cct-sandbox-v1",

  // Bootstrap hook：template-scoped，运行一次
  // 当前无初始化任务（jq 已移除：deny-all 下无法 apt-get install，且项目未使用 jq）
  // 如需安装系统包，应在此处临时放开网络策略：
  //   const sandbox = await use({ networkPolicy: "allow-egress" });
  //   await sandbox.run({ command: "apt-get update && apt-get install -y <pkg>" });
  //   await sandbox.setNetworkPolicy({ allow: false });
  async bootstrap() {
    // 无操作
  },

  // OnSession hook：session-scoped，每个 session 运行一次
  async onSession({ use, ctx }) {
    const sandbox = await use({ networkPolicy: "deny-all" });
    const user = ctx.session.auth.current;

    // 已登录用户写入用户信息
    if (user !== null) {
      await sandbox.writeTextFile({
        path: "SESSION_USER.txt",
        content: `${user.principalId}\n`,
      });
    }
  },
});
