/**
 * @file EVE Sandbox 配置
 * @description 定义 Agent 的隔离 bash 环境，配置后端、网络策略和初始化脚本
 * @module agent/sandbox/sandbox
 */

import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Sandbox 定义
 *
 * 使用 Vercel Sandbox 后端，提供隔离的 bash 环境。
 * - 默认网络策略：deny-all（禁止所有网络访问）
 * - bootstrap：template-scoped，运行一次，安装基础依赖
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
  async bootstrap({ use }) {
    const sandbox = await use();
    // 安装基础工具
    await sandbox.run({ command: "apt-get update && apt-get install -y jq" });
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
