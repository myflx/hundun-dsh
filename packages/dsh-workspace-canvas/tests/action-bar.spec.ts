import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { CanvasView } from '../src/client/canvas/CanvasView.tsx'

// jsdom 环境缺 PointerEvent：polyfill 最小实现（React pointer 处理器需要）。
beforeAll(() => {
  if (typeof globalThis.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId = 1
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params)
      }
    }
    ;(globalThis as any).PointerEvent = PointerEventPolyfill
  }
})

function feedWith(items: unknown[], archived: string[] = []): any {
  const snapshot = { items, baselinesReady: true, recentWorkspaceId: undefined, archivedSessionIds: archived }
  return { list: { subscribe: () => () => {}, getSnapshot: () => snapshot } }
}

const ws = (id: string, title: string, sessionIds: string[] = []) => ({ workspaceId: id, title, path: `/repo/${id}`, sessionIds })

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.useRealTimers()
})

async function renderView(feed: any, store: CanvasDocumentStore, ctx?: any) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(CanvasView, { workspaces: feed, store, onClose: () => {}, ctx }))
  })
  return { container, root }
}

/** 读当前 view 变换字符串（节点层 transform）。 */
function viewTransformOf(container: HTMLElement): string {
  const vp = container.querySelector<HTMLElement>('[data-dsh-canvas-viewport]')
  return vp?.style.transform ?? ''
}

describe('画布操作栏（对齐 hundun-web：缩小/重置/放大/刷新，纯图标按钮）', () => {
  it('渲染底部操作栏四图标按钮，顺序 缩小→重置→放大→刷新；无文字；右上角无独立缩放工具', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    expect(bar).not.toBeNull()
    // 顺序断言：按 DOM 顺序取 data-dsh-action-* 标记
    const buttons = [...(bar?.querySelectorAll('button') ?? [])].map((b) =>
      b.getAttribute('data-dsh-action-zoom-out') !== null ? 'zoom-out'
        : b.getAttribute('data-dsh-action-reset') !== null ? 'reset'
          : b.getAttribute('data-dsh-action-zoom-in') !== null ? 'zoom-in'
            : b.getAttribute('data-dsh-action-refresh') !== null ? 'refresh' : '?')
    expect(buttons).toEqual(['zoom-out', 'reset', 'zoom-in', 'refresh'])
    // 纯图标：每个按钮含 svg 且无文字
    for (const btn of bar!.querySelectorAll('button')) {
      expect(btn.querySelector('svg')).not.toBeNull()
      expect(btn.textContent?.trim() ?? '').toBe('')
    }
    // 图标语义 aria-label（悬停提示）
    expect(bar!.querySelector('[data-dsh-action-zoom-out]')?.getAttribute('aria-label')).toBe('缩小')
    expect(bar!.querySelector('[data-dsh-action-reset]')?.getAttribute('aria-label')).toBe('重置视图')
    expect(bar!.querySelector('[data-dsh-action-zoom-in]')?.getAttribute('aria-label')).toBe('放大')
    expect(bar!.querySelector('[data-dsh-action-refresh]')?.getAttribute('aria-label')).toBe('刷新')
    // FR-003：右上角独立缩放工具已移除
    expect(container.querySelector('[data-dsh-canvas-toolbar]')).toBeNull()
    await act(async () => root.unmount())
  })

  it('操作栏样式仅用系统设计令牌（无硬编码颜色），图标走 currentColor', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    const style = bar?.getAttribute('style') ?? ''
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(style).toContain('var(--dsw-alias-bg-layer-1')
    expect(style).toContain('var(--dsw-alias-border-l2')
    // 图标颜色走 currentColor（跟随按钮 label 令牌）
    const svg = bar?.querySelector('svg')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
    await act(async () => root.unmount())
  })

  it('放大/缩小 10% 步进（viewport transform）；重置回 100% + 原点', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-in]')
    await act(async () => { zoomIn!.click() })
    expect(viewTransformOf(container)).toMatch(/scale\(1\.1/) // 放大 110%
    const zoomOut = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-out]')
    await act(async () => { zoomOut!.click() })
    expect(viewTransformOf(container)).toMatch(/scale\(0\.99/) // 1.1×0.9
    const reset = container.querySelector<HTMLButtonElement>('[data-dsh-action-reset]')
    await act(async () => { reset!.click() })
    expect(viewTransformOf(container)).toBe('translate(0px, 0px) scale(1)')
    await act(async () => root.unmount())
  })

  it('点击刷新 → 调用 workspaces.refresh 一次（运行时可选链）', async () => {
    const refresh = vi.fn(() => Promise.resolve())
    const ctx = { workspaces: { refresh } }
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage), ctx as any)
    const btn = container.querySelector<HTMLButtonElement>('[data-dsh-action-refresh]')
    await act(async () => { btn!.click() })
    await act(async () => { await Promise.resolve() })
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('刷新能力缺失/失败 → 安全降级（不抛错、画布保持）', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const btn = container.querySelector<HTMLButtonElement>('[data-dsh-action-refresh]')
    await act(async () => { btn!.click() })
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('[data-dsh-action-bar]')).not.toBeNull()
    expect(viewTransformOf(container)).toContain('scale(1)')
    await act(async () => root.unmount())
  })
})

describe('画布空白交互（手型光标 + 取消选中）与归档计数', () => {
  it('卡片会话数按未归档显示（dsh 语义：归档保留在 sessionIds，分组界面隐藏）', async () => {
    const { container, root } = await renderView(
      feedWith([ws('w1', 'A', ['s1', 's2', 's3'])], ['s2']), // s2 已归档
      new CanvasDocumentStore(localStorage),
    )
    const card = container.querySelector<HTMLElement>('[data-dsh-canvas-card]')
    // 3 个会话中 2 个未归档：显示「2 个会话 · 1 归档」
    expect(card?.textContent).toContain('2 个会话')
    expect(card?.textContent).toContain('1 归档')
    await act(async () => root.unmount())
  })

  it('画布空白区域光标 grab；空白拖拽平移中 grabbing', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const area = container.querySelector<HTMLElement>('[data-dsh-canvas-area]')
    expect(area).not.toBeNull()
    expect(area!.style.cursor).toBe('grab')
    // 空白按下 → grabbing（pointer 事件；jsdom 需派发 PointerEvent）
    await act(async () => {
      area!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
    })
    expect(area!.style.cursor).toBe('grabbing')
    await act(async () => {
      area!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
    })
    expect(area!.style.cursor).toBe('grab')
    await act(async () => root.unmount())
  })

  it('点画布空白 → 取消工作区选中（明细收起）', async () => {
    const store = new CanvasDocumentStore(localStorage)
    // 预置工作区节点投影（真实画布由 syncWorkspaceNodes 补建；明细按 doc 节点渲染）
    store.mutate((d) => { d.nodes.push({ id: 'ws:w1', kind: 'workspace', ref: 'w1', position: { x: 12, y: 12 } }) })
    const ctx = { workspaces: { startSession: () => {}, rename: () => Promise.resolve(), delete: () => Promise.resolve(), archiveSession: () => Promise.resolve() } }
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), store, ctx as any)
    // 先打开明细（右键详情）
    const card = container.querySelector<HTMLElement>('[data-dsh-canvas-card]')
    await act(async () => { card!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) })
    await act(async () => {
      // 原生 Menu portal 到 body：按文本找「详情」项
      const detail = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent?.includes('详情')) as HTMLButtonElement | undefined
      expect(detail).not.toBeUndefined()
      detail!.click()
    })
    expect(container.querySelector('[data-dsh-canvas-detail]')).not.toBeNull()
    // 点空白 → 明细收起
    const area = container.querySelector<HTMLElement>('[data-dsh-canvas-area]')
    await act(async () => {
      area!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
    })
    await act(async () => {
      area!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
    })
    expect(container.querySelector('[data-dsh-canvas-detail]')).toBeNull()
    await act(async () => root.unmount())
  })
})
