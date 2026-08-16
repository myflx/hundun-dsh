/**
 * 画布控制器：画布开/关状态的唯一所有者 + 中间区域挂载管理。
 *
 * 结构参照 dsh-ssh 的 panel/controller.ts（框架无关的订阅面）与
 * client/mount.tsx（中间区域 DOM 接管）。要点：
 *
 * - `conversation` 槽位是单占用的，外部插件不能声明槽位，所以画布在
 *   DOM 层接管中间区域：往 `[data-pane="conversation"]` 列追加一个容器，
 *   用 `<html data-dsh-canvas-active>` 属性 + 注入的样式规则隐藏对话内容
 *   （对话子树保持挂载、状态不丢），并显示画布容器；
 * - 与任务看板 / SSH 面板互斥：复用 dsh-ssh 的 `dsh-panel-activate` 事件
 *   协议 —— 本画布激活时清掉对方的 html 属性并广播自己的名字；收到对方
 *   激活事件时关闭自己；
 * - 点侧边栏的会话/工作区行时自动退出画布，把中间区域还给对话。
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { CanvasView } from './CanvasView.tsx'

/** 画布视图容器（保持挂载，隐藏时不可见）。 */
export const CANVAS_VIEW_SELECTOR = '[data-dsh-canvas-view]'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"]'
const ACTIVE_ATTR = 'data-dsh-canvas-active'
/** 对方面板的激活属性（任务看板 / SSH），打开画布时清掉。 */
const OTHER_ACTIVE_ATTRS = ['data-dsh-taskboard-active', 'data-dsh-ssh-active']
/** 跨插件激活事件（dsh-ssh 协议）。 */
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'workspace-canvas'

/** 隐藏对话内容、显示画布容器的样式（注入 <style data-plugin>，卸载时移除）。
 *  容器用 absolute + inset:0 铺满整个中间区域（dsh-ssh 面板同款），
 *  z-index 60 盖过对话/输入卡，背景不透底。 */
const CANVAS_STYLE = `
[data-pane="conversation"] { position: relative; }
[data-dsh-canvas-view] {
  position: absolute;
  inset: 0;
  display: none;
  z-index: 60;
  background: var(--dsw-alias-bg-base);
}
html[data-dsh-canvas-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-canvas-view] { display: flex; }
html[data-dsh-canvas-active] [data-pane="conversation"] > :not([data-dsh-canvas-view]),
html[data-dsh-canvas-active] [class*="centerCol"] > :not([data-dsh-canvas-view]) { display: none !important; }
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
  private waitObserver: MutationObserver | undefined
  private onOtherActivate = (event: Event): void => {
    const name = (event as CustomEvent).detail
    // 任务看板 / SSH 激活时，把中间区域让给对方。
    if (name === 'taskboard' || name === 'ssh') this.close()
  }
  private onClickSidebarRow = (event: MouseEvent): void => {
    if (!this.opened) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    // 点侧边栏会话/工作区行（包括新会话按钮）时退出画布；capture 阶段，
    // 先于 shell 处理点击，面板先关，避免跳转后画布还占着中间区域。
    const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) this.close()
  }

  constructor(private readonly ctx: ClientContext) {}

  getSnapshot(): CanvasControllerSnapshot {
    return { open: this.opened }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** 启动：挂载互斥监听 + 中间区域观察器。插件 apply 时调用一次。 */
  start(): void {
    document.addEventListener(ACTIVATE_EVENT, this.onOtherActivate)
    document.addEventListener('click', this.onClickSidebarRow, true)
    this.waitObserver = new MutationObserver(() => { this.ensure() })
    this.waitObserver.observe(document.body, { childList: true, subtree: true })
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

  /** 卸载：拆 React 树、移除容器/样式、断开观察器、恢复 html 属性。 */
  dispose(): void {
    this.waitObserver?.disconnect()
    this.waitObserver = undefined
    document.removeEventListener(ACTIVATE_EVENT, this.onOtherActivate)
    document.removeEventListener('click', this.onClickSidebarRow, true)
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    this.root?.unmount()
    this.root = undefined
    this.container?.remove()
    this.container = undefined
    this.styleTag?.remove()
    this.styleTag = undefined
    this.listeners.clear()
  }

  /** 把激活状态反映到 DOM（html 属性 + 广播）。 */
  private applyActive(): void {
    if (this.opened) {
      for (const attr of OTHER_ACTIVE_ATTRS) document.documentElement.removeAttribute(attr)
      document.documentElement.setAttribute(ACTIVE_ATTR, '')
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
    } else {
      document.documentElement.removeAttribute(ACTIVE_ATTR)
    }
  }

  /** 挂载画布 React 树（等待中间区域出现，React 重建后自愈重挂）。 */
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
