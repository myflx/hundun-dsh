/**
 * 侧边栏工作区搜索框的「画布视图」按钮注入（React 版）。
 *
 * 侧边栏的工作区浏览区域（含搜索框）是单占用槽位 sidebar.workspaces，
 * 由官方 WorkspaceBrowser 独占，没有搜索框内部的官方槽位 —— 所以按钮走
 * DOM 注入（全家桶 既有面板 sidebar-entry.ts 同款模式）：
 *
 * - 按钮是一个独立的 React 根（createRoot 挂到标题行），hover 提示用
 *   官方 primitives 的 Tooltip 组件（side="bottom" delayMs=500），
 *   与原生图标按钮（搜索图标等）的提示浮层样式完全一致；
 * - 位置：插到搜索框（searchSlot）右侧、右侧操作组（headerActions）
 *   左侧，标题行自带 gap:4px，各图标间距一致；
 * - 自愈：MutationObserver 监听 body 与标题行，React 重渲染挤掉容器时
 *   同帧重插（不闪烁）；
 * - 点击：toggle 画布控制器；打开时按钮高亮（激活态）。
 */
import { useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CSSProperties } from 'react'
import type { CanvasController } from './canvas/controller.ts'
import type { MountSupervisor } from './canvas/mount-supervisor.ts'
import { canvasText } from './canvas/text.ts'

/** 稳定 data 属性标识注入的按钮。 */
export const ENTRY_SELECTOR = '[data-dsh-canvas-entry]'

const ENTRY_ROOT_SELECTOR = '[data-dsh-canvas-entry-root]'

/** 画布/网格 glyph（与 shell 16px 导航图标风格一致）。 */
function CanvasIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  )
}

/** 按钮静态布局（颜色/背景交给注入 CSS 与激活态 inline）。 */
const ENTRY_BUTTON_STYLE: CSSProperties = {
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'inline-flex',
  flex: 'none',
  height: '28px',
  justifyContent: 'center',
  padding: '0',
  width: '28px',
}

/** 画布入口按钮：Tooltip 浮层 + 图标按钮。 */
function CanvasEntryButton({ controller }: { controller: CanvasController }) {
  const [open, setOpen] = useState(controller.getSnapshot().open)
  useEffect(() => controller.subscribe(() => setOpen(controller.getSnapshot().open)), [controller])
  return (
    <Tooltip label={canvasText('canvas.buttonTooltip')} side="bottom" delayMs={500}>
      <button
        type="button"
        data-dsh-canvas-entry
        aria-label={canvasText('canvas.buttonTooltip')}
        onClick={(event) => {
          event.stopPropagation()
          controller.toggle()
        }}
        style={{
          ...ENTRY_BUTTON_STYLE,
          color: open ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-label-secondary)',
          background: open ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
        }}
      >
        <CanvasIcon />
      </button>
    </Tooltip>
  )
}

/** 注入按钮 hover 样式（与原图标按钮一致：interactive-bg-hover 圆形高亮）。 */
function ensureEntryStyle(): void {
  const id = 'dsh-workspace-canvas-entry'
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-workspace-canvas'
  tag.dataset.pluginCss = id
  tag.textContent = [
    `[data-dsh-canvas-entry]:hover { background: var(--dsw-alias-interactive-bg-hover); }`,
    // React 根容器：参与标题行 flex 布局，按钮在容器内。
    `[data-dsh-canvas-entry-root] { display: inline-flex; flex: none; }`,
  ].join('\n')
  document.head.appendChild(tag)
}

/** 找到工作区浏览区的标题行（搜索框所在行）。 */
function searchHeader(root: HTMLElement): HTMLElement | undefined {
  return root.querySelector<HTMLElement>('[class*="sectionHeader"]') ?? undefined
}

/**
 * 挂载画布入口按钮（React 根），等待侧边栏渲染并自愈。
 * @param controller - 画布控制器（按钮 toggle 它）。
 * @param supervisor - 单一挂载监督器：按钮定位自愈注册到其上（T007）。
 * @returns disposer 注销监督回调、卸载 React 根、移除容器。
 */
export function mountSearchButton(controller: CanvasController, supervisor: MountSupervisor): () => void {
  ensureEntryStyle()

  const container = document.createElement('div')
  container.dataset.dshCanvasEntryRoot = ''
  const root: Root = createRoot(container)
  root.render(<CanvasEntryButton controller={controller} />)

  let header: HTMLElement | undefined

  const tryPlace = (): void => {
    const column = document.querySelector<HTMLElement>('[data-slot="sidebar"], [data-pane="sidebar"], [class*="sidebarCol"]')
    if (column === null) return
    // 标题行缺失或已被 React 重建时，重新定位（mutation 时序：sidebar 列
    // 先挂载、WorkspaceBrowser 内容后渲染，因此每次都要重新查）。
    if (header === undefined || !header.isConnected || !column.contains(header)) {
      header = searchHeader(column)
    }
    if (header === undefined) return
    if (container.parentElement === header) return
    // 搜索框右侧、右侧操作组左侧；找不到操作组则插到标题行末尾。
    const actions = header.querySelector<HTMLElement>('[class$="_headerActions"]')
    if (actions !== null) header.insertBefore(container, actions)
    else header.appendChild(container)
  }

  // 自愈统一走挂载监督器（DOM 变更批量 flush 时幂等重定位）。
  const unregister = supervisor.register(tryPlace)

  tryPlace()

  return () => {
    unregister()
    root.unmount()
    container.remove()
    // 移除注入的按钮样式（与容器同生命周期）。
    document.querySelector('style[data-plugin-css="dsh-workspace-canvas-entry"]')?.remove()
  }
}
