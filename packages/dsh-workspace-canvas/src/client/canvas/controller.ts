/**
 * 画布控制器：画布开/关状态的唯一所有者 + 中间区域挂载管理。
 *
 * 结构参照 dsh-ssh 的 panel/controller.ts（框架无关的订阅面）与
 * client/mount.tsx（中间区域 DOM 接管）。要点（对齐定稿设计 T005/T007）：
 *
 * - `conversation` 槽位是单占用的，外部插件不能声明槽位，所以画布在
 *   DOM 层接管中间区域：往 `[data-pane="conversation"]` 列追加一个容器，
 *   注入样式规则隐藏对话内容（对话子树保持挂载、状态不丢）并显示画布；
 * - 面板互斥：单一激活标记协议（@hundun/dsh-panel-protocol）——
 *   打开时写 `data-dsh-panel-active="workspace-canvas"` 并广播
 *   `dsh-panel-activate`（后写者胜）；收到其他面板激活事件即让位关闭；
 *   不再枚举/擦除任何其他面板的属性；
 * - 挂载自愈交给单一挂载监督器（MountSupervisor）：start 时注册 ensure，
 *   对话列重建后自动重挂，观察器不再由本控制器自持；
 * - 点侧边栏的会话/工作区行时自动退出画布，把中间区域还给对话。
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ACTIVE_ATTR, PANELS, activate, isActive, onOtherActivate } from '@hundun/dsh-panel-protocol'
import type { MountSupervisor } from './mount-supervisor.ts'
import type { CanvasDocumentStore } from './document.ts'
import type { CanvasRegistryImpl } from './registry.ts'
import { CanvasView } from './CanvasView.tsx'

/** 画布视图容器（保持挂载，隐藏时不可见）。 */
export const CANVAS_VIEW_SELECTOR = '[data-dsh-canvas-view]'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"]'
/** 本面板名（单标记协议：`data-dsh-panel-active` 的值）。 */
const OWN_NAME = PANELS.workspaceCanvas

/** 隐藏对话内容、显示画布容器的样式（注入 <style data-plugin>，卸载时移除）。
 *  容器用 absolute + inset:0 铺满整个中间区域（dsh-ssh 面板同款），
 *  z-index 60 盖过对话/输入卡，背景不透底。显示条件 = 单标记为本面板名。 */
const CANVAS_STYLE = `
[data-pane="conversation"] { position: relative; }
[data-dsh-canvas-view] {
  position: absolute;
  inset: 0;
  display: none;
  z-index: 60;
  background: var(--dsw-alias-bg-base);
}
html[data-dsh-panel-active="workspace-canvas"] [data-dsh-canvas-view] { display: flex; }
html[data-dsh-panel-active="workspace-canvas"] [data-pane="conversation"] > :not([data-dsh-canvas-view]),
html[data-dsh-panel-active="workspace-canvas"] [class*="centerCol"] > :not([data-dsh-canvas-view]) { display: none !important; }
`

/** 控制器快照（供订阅方读取）。 */
export interface CanvasControllerSnapshot {
  open: boolean
}

/** 画布状态所有者 + 中间区域挂载器。 */
export class CanvasController {
  private opened = false
  private listeners = new Set<() => void>()
  private root: Root | undefined
  private container: HTMLDivElement | undefined
  private styleTag: HTMLStyleElement | undefined
  private unregisterEnsure: (() => void) | undefined
  private disposeOtherListener: (() => void) | undefined
  private onClickSidebarRow = (event: MouseEvent): void => {
    if (!this.opened) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    // 点侧边栏会话/工作区行（包括新会话按钮）时退出画布；capture 阶段，
    // 先于 shell 处理点击，面板先关，避免跳转后画布还占着中间区域。
    const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) this.close()
  }

  constructor(
    private readonly ctx: ClientContext,
    private readonly store: CanvasDocumentStore,
    private readonly registry: CanvasRegistryImpl,
  ) {}

  getSnapshot(): CanvasControllerSnapshot {
    return { open: this.opened }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /**
   * 启动：注册挂载自愈 + 互斥监听 + 侧边栏点击让位。插件 apply 时调用一次。
   * @param supervisor - 单一挂载监督器（画布挂载自愈注册到其上）。
   */
  start(supervisor: MountSupervisor): void {
    this.unregisterEnsure = supervisor.register(() => { this.ensure() })
    this.disposeOtherListener = onOtherActivate(OWN_NAME, () => { this.close() })
    document.addEventListener('click', this.onClickSidebarRow, true)
  }

  open(): void {
    if (this.opened) return
    this.opened = true
    this.applyActive()
    this.ensure()
    this.notify()
  }

  close(): void {
    if (!this.opened) return
    this.opened = false
    this.applyActive()
    this.notify()
  }

  toggle(): void {
    if (this.opened) this.close()
    else this.open()
  }

  /** 卸载：注销挂载/互斥监听、移除标记、拆 React 树、移除容器与样式。 */
  dispose(): void {
    this.unregisterEnsure?.()
    this.unregisterEnsure = undefined
    this.disposeOtherListener?.()
    this.disposeOtherListener = undefined
    document.removeEventListener('click', this.onClickSidebarRow, true)
    // 仅当标记仍是自己时移除（互斥让位后标记属于对方，不碰）。
    if (isActive(OWN_NAME)) document.documentElement.removeAttribute(ACTIVE_ATTR)
    this.root?.unmount()
    this.root = undefined
    this.container?.remove()
    this.container = undefined
    this.styleTag?.remove()
    this.styleTag = undefined
    this.listeners.clear()
  }

  /** 把激活状态反映到单一激活标记（写标记 + 广播 / 移除自己的标记）。 */
  private applyActive(): void {
    if (this.opened) {
      activate(OWN_NAME)
    } else if (isActive(OWN_NAME)) {
      document.documentElement.removeAttribute(ACTIVE_ATTR)
    }
  }

  /** 挂载画布 React 树（等待中间区域出现，对话列重建后自愈重挂）。 */
  private ensure(): void {
    if (this.container !== undefined) {
      if (this.container.isConnected) return
      // 对话列被重建；拆旧树重挂。
      this.root?.unmount()
      this.root = undefined
      this.container.remove()
      this.container = undefined
    }
    const column = document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR)
    if (column === null) return
    this.styleTag ??= this.injectStyle()
    this.container = document.createElement('div')
    this.container.dataset.dshCanvasView = ''
    column.appendChild(this.container)
    this.root = createRoot(this.container)
    this.root.render(createElement(CanvasView, {
      workspaces: this.ctx.workspaces,
      store: this.store,
      registry: this.registry,
      ctx: this.ctx,
      onClose: () => this.close(),
    }))
  }

  /** 注入画布样式（幂等：已存在则复用）。 */
  private injectStyle(): HTMLStyleElement {
    const id = 'dsh-workspace-canvas'
    const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${id}"]`)
    if (existing !== null) return existing
    const tag = document.createElement('style')
    tag.dataset.plugin = id
    tag.dataset.pluginCss = id
    tag.textContent = CANVAS_STYLE
    document.head.appendChild(tag)
    return tag
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
