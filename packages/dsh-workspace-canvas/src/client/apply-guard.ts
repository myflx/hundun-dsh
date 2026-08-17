/**
 * 客户端 apply 防重复挂载（T006）。
 *
 * 同一页面内 bundle 工厂重复执行（HMR 重载 / 双份加载）时，只允许首次
 * apply 生效，其余静默返回；卸载（effect 释放）后释放 claim，重建的
 * bundle 可再次 claim。模式同 共享预设 家族 task-board 的 apply-guard。
 */
let claimed = false

/** 尝试取得本插件客户端 apply 的唯一资格；失败表示已有实例生效。 */
export function claimCanvasApply(): boolean {
  if (claimed) return false
  claimed = true
  return true
}

/** 释放资格（插件卸载 / fiber 释放时调用）。 */
export function releaseCanvasApply(): void {
  claimed = false
}
