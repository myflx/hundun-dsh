/**
 * 画布运行时（T033 修正）：画布本体挂载/卸载的单一所有者。
 *
 * enabled 总开关实时联动：true → mount 全部（文档存储/注册服务/挂载监督器/
 * 控制器/入口按钮）；false → 立即 unmount（用户设置经 enabled-store，组合配置
 * 兜底）。设置栏目常驻注册（index.ts apply），不随 enabled 卸载。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { CanvasController } from './canvas/controller.ts'
import { CanvasDocumentStore } from './canvas/document.ts'
import { MountSupervisor } from './canvas/mount-supervisor.ts'
import { installCanvasRegistry } from './canvas/registry.ts'
import { syncWorkspaceNodes } from './canvas/workspace-nodes.ts'
import { mountSearchButton } from './search-button.tsx'

/** 画布全部客户端效果的容器：mount 一次性装配，unmount 按逆序回收。 */
export class CanvasRuntime {
  private mounted = false
  private disposers: Array<() => void> = []

  constructor(private readonly ctx: ClientContext) {}

  get isMounted(): boolean {
    return this.mounted
  }

  /** 装配全部画布效果（幂等）。 */
  mount(): void {
    if (this.mounted) return
    this.mounted = true
    const ctx = this.ctx
    const disposers: Array<() => void> = []
    const push = (dispose: () => void): void => { disposers.push(dispose) }

    // 文档存储 + ctx.canvas 注册服务（T008/T009）。
    const store = new CanvasDocumentStore()
    push(() => store.dispose())
    const installed = installCanvasRegistry(ctx, store)
    const registry = installed.registry
    push(installed.dispose)

    // T018：工作区节点投影同步。
    const syncWorkspaces = (): void => {
      const items = ctx.workspaces.list.getSnapshot().items ?? []
      const removed = syncWorkspaceNodes(store, items)
      for (const id of removed) {
        console.warn(`[workspace-canvas] 工作区已消失，其画布节点与成员已清理：${id}`)
      }
    }
    push(ctx.workspaces.list.subscribe(syncWorkspaces))
    syncWorkspaces()

    // 单一挂载监督器 + 画布控制器 + 入口按钮（T005/T007/T011）。
    const supervisor = new MountSupervisor()
    supervisor.start()
    push(() => supervisor.dispose())
    const canvas = new CanvasController(ctx, store, registry)
    canvas.start(supervisor)
    push(() => canvas.dispose())
    push(mountSearchButton(canvas, supervisor))

    this.disposers = disposers
  }

  /** 立即卸载全部效果（幂等；enabled=false 时调用，clarify Q1）。 */
  unmount(): void {
    if (!this.mounted) return
    this.mounted = false
    for (const dispose of this.disposers.splice(0).reverse()) dispose()
  }

  /** 卸载并释放。 */
  dispose(): void {
    this.unmount()
  }
}
