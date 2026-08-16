import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { CanvasView } from '../src/client/canvas/CanvasView.tsx'

function feedWith(items: unknown[]): any {
  const snapshot = { items, baselinesReady: true, recentWorkspaceId: undefined }
  return { list: { subscribe: () => () => {}, getSnapshot: () => snapshot } }
}

const ws = (id: string, title: string) => ({ workspaceId: id, title, path: `/repo/${id}`, sessionIds: [] })

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.useRealTimers()
})

async function renderView(feed: any, store: CanvasDocumentStore) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(CanvasView, { workspaces: feed, store, onClose: () => {} }))
  })
  return { container, root }
}

describe('底部操作栏（US1 缩放整合）', () => {
  it('渲染操作栏（−/百分比/+/重置视图/自动布局/聚焦），右上角无独立缩放工具', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    expect(bar).not.toBeNull()
    expect(container.querySelector('[data-dsh-action-zoom-out]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-action-zoom-in]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('100')
    expect(container.querySelector('[data-dsh-action-reset]')?.textContent).toContain('重置视图')
    expect(container.querySelector('[data-dsh-action-layout]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-action-focus]')).not.toBeNull()
    // FR-002：右上角独立缩放工具已移除
    expect(container.querySelector('[data-dsh-canvas-toolbar]')).toBeNull()
    await act(async () => root.unmount())
  })

  it('操作栏样式仅用系统设计令牌（无硬编码颜色/圆角/阴影）', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    const style = bar?.getAttribute('style') ?? ''
    // 颜色/边框/背景/文字/悬停均走 var(--dsw-alias-*)；允许 rgba 兜底（系统令牌缺失时）但不得出现 #hex 硬编码
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(style).toContain('var(--dsw-alias-surface-raised')
    expect(style).toContain('var(--dsw-alias-border-l2')
    await act(async () => root.unmount())
  })

  it('缩放按钮 10% 步进并实时更新百分比；重置回 100%', async () => {
    vi.useFakeTimers()
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-in]')
    await act(async () => { zoomIn!.click() })
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('110')
    const reset = container.querySelector<HTMLButtonElement>('[data-dsh-action-reset]')
    await act(async () => { reset!.click() })
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('100')
    await act(async () => root.unmount())
  })
})

describe('自动布局（US2）', () => {
  it('点击自动布局 → 全部工作区 GRID 重排（内存 doc 同步；落盘由 workspace-position.spec 覆盖）', async () => {
    const store = new CanvasDocumentStore(localStorage)
    // 预置错位位置
    store.mutate((d) => {
      d.nodes.push(
        { id: 'ws:a', kind: 'workspace', ref: 'a', position: { x: 500, y: 500 } },
        { id: 'ws:b', kind: 'workspace', ref: 'b', position: { x: 520, y: 520 } },
      )
    })
    const { container, root } = await renderView(feedWith([ws('a', 'A'), ws('b', 'B')]), store)
    const layout = container.querySelector<HTMLButtonElement>('[data-dsh-action-layout]')
    await act(async () => { layout!.click() })
    const cards = [...container.querySelectorAll<HTMLElement>('[data-dsh-canvas-card]')]
    expect(cards[0].style.left).toBe('12px')
    expect(cards[0].style.top).toBe('12px')
    expect(cards[1].style.left).toBe('228px')
    expect(cards[1].style.top).toBe('12px')
    const doc = store.read()
    const pos = Object.fromEntries(doc.nodes.filter((n) => n.kind === 'workspace').map((n) => [n.ref, n.position]))
    expect(pos).toEqual({ a: { x: 12, y: 12 }, b: { x: 228, y: 12 } })
    await act(async () => root.unmount())
  })

  it('无工作区 → 空状态引导，不渲染操作栏（空操作不报错）', async () => {
    const { container, root } = await renderView(feedWith([]), new CanvasDocumentStore(localStorage))
    expect(container.textContent).toContain('还没有工作区')
    expect(container.querySelector('[data-dsh-action-bar]')).toBeNull()
    await act(async () => root.unmount())
  })
})

describe('聚焦工作区（US3）', () => {
  it('选择目标 → view 平移使目标居中且 zoom 不变', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push({ id: 'ws:w1', kind: 'workspace', ref: 'w1', position: { x: 900, y: 600 } })
      d.view = { x: -200, y: -100, zoom: 1.5 }
    })
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), store)
    // 打开聚焦菜单并选择目标
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-dsh-action-focus]')!.click() })
    const menu = container.querySelector<HTMLElement>('[data-dsh-action-focus-menu]')
    expect(menu).not.toBeNull()
    await act(async () => { menu!.querySelector('button')!.click() })
    // 视口尺寸：jsdom 无布局，getBoundingClientRect 返回 0 → area rect 0×0；
    // 用 viewport 0 时 focusView 结果：x = -900*1.5 = -1350, y = -600*1.5 = -900, zoom 不变
    const viewport = container.querySelector<HTMLElement>('[data-dsh-canvas-viewport]')
    expect(viewport!.style.transform).toContain('scale(1.5)')
    await act(async () => root.unmount())
  })

  it('聚焦目标缺失（feed 中消失）→ 菜单无该目标、视图不变（E2E-12）', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.view = { x: 10, y: 20, zoom: 1 } })
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), store)
    // 菜单项来自 feed：只有 w1，无幽灵目标
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-dsh-action-focus]')!.click() })
    const labels = [...container.querySelectorAll('[data-dsh-action-focus-menu] button')].map((b) => b.textContent)
    expect(labels).toEqual(['A'])
    // 点开菜单后视图不变
    const viewport = container.querySelector<HTMLElement>('[data-dsh-canvas-viewport]')
    expect(viewport!.style.transform).toBe('translate(10px, 20px) scale(1)')
    await act(async () => root.unmount())
  })
})
