/** @file 用户配额（entitlements）配置，定义当前用户可使用的资源上限。 */

/** 用户配额类型定义。 */
type Entitlements = {
  /** 每小时最大消息数限制。 */
  maxMessagesPerHour: number;
};

/** 当前生效的配额配置：每小时最多 100 条消息。 */
export const entitlements: Entitlements = {
  maxMessagesPerHour: 100,
};
