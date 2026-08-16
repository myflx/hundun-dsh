/**
 * 单一挂载监督器（T007）。
 *
 * 合并画布挂载与按钮自愈的两套 MutationObserver 为一个 body 级观察器 +
 * 微任务批处理：各挂载目标（对话列容器、侧边栏按钮行）经 `register` 注册
 * 幂等的 ensure 回调，DOM 变更时批量执行一次。卸载/重建场景由回调自愈，
 * 观察范围与回调次数都收敛（原来每个挂载点各开一个全 body 观察器）。
 */
export class MountSupervisor {
  private observer: MutationObserver | undefined
  private ensureFns = new Set<() => void>()
  private scheduled = false

  private flush = (): void => {
    this.scheduled = false
    for (const fn of [...this.ensureFns]) fn()
  }

  private onMutation = (): void => {
    if (this.scheduled) return
    this.scheduled = true
    // 同帧/同微任务批内的多次变更合并为一次 flush（幂等 ensure，重复执行安全）。
    queueMicrotask(this.flush)
  }

  /** 开始观察 document.body（幂等）。 */
  start(): void {
    if (this.observer !== undefined) return
    this.observer = new MutationObserver(this.onMutation)
    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  /** 注册一个幂等的挂载确保回调；返回注销函数。 */
  register(fn: () => void): () => void {
    this.ensureFns.add(fn)
    return () => this.ensureFns.delete(fn)
  }

  /** 卸载：断开观察器并清空回调。 */
  dispose(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.ensureFns.clear()
    this.scheduled = false
  }
}
