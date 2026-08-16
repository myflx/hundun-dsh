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

async function renderView(feed: any, store: CanvasDocumentStore, ctx?: any) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(CanvasView, { workspaces: feed, store, onClose: () => {}, ctx }))
  })
  return { container, root }
}

describe('画布操作栏（对齐 hundun-web：缩小/重置/放大/刷新）', () => {
  it('渲染底部操作栏四按钮，顺序为 缩小→重置→放大→刷新；右上角无独立缩放工具', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    expect(bar).not.toBeNull()
    // 顺序断言：按 DOM 顺序取按钮 data-dsh-action-* 标记
    const buttons = [...(bar?.querySelectorAll('button') ?? [])].map((b) =>
      b.getAttribute('data-dsh-action-zoom-out') !== null ? 'zoom-out'
        : b.getAttribute('data-dsh-action-reset') !== null ? 'reset'
          : b.getAttribute('data-dsh-action-zoom-in') !== null ? 'zoom-in'
            : b.getAttribute('data-dsh-action-refresh') !== null ? 'refresh' : '?')
    expect(buttons).toEqual(['zoom-out', 'reset', 'zoom-in', 'refresh'])
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('100')
    // FR-002：右上角独立缩放工具已移除
    expect(container.querySelector('[data-dsh-canvas-toolbar]')).toBeNull()
    // v2：自动布局/聚焦不再出现
    expect(container.querySelector('[data-dsh-action-layout]')).toBeNull()
    expect(container.querySelector('[data-dsh-action-focus]')).toBeNull()
    await act(async () => root.unmount())
  })

  it('操作栏样式仅用系统设计令牌（无硬编码颜色）', async () => {
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const bar = container.querySelector<HTMLElement>('[data-dsh-action-bar]')
    const style = bar?.getAttribute('style') ?? ''
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(style).toContain('var(--dsw-alias-surface-raised')
    expect(style).toContain('var(--dsw-alias-border-l2')
    await act(async () => root.unmount())
  })

  it('放大/缩小 10% 步进并实时更新百分比；重置回 100%', async () => {
    vi.useFakeTimers()
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-in]')
    await act(async () => { zoomIn!.click() })
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('110')
    const zoomOut = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-out]')
    await act(async () => { zoomOut!.click() })
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('99') // 1.1×0.9=0.99
    const reset = container.querySelector<HTMLButtonElement>('[data-dsh-action-reset]')
    await act(async () => { reset!.click() })
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('100')
    await act(async () => root.unmount())
  })

  it('点击刷新 → 调用 workspaces.refresh 一次（IWorkspaces 接口未暴露，运行时可选链）', async () => {
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
    // 无 ctx（无 workspaces.refresh）→ 点击不抛错
    const { container, root } = await renderView(feedWith([ws('w1', 'A')]), new CanvasDocumentStore(localStorage))
    const btn = container.querySelector<HTMLButtonElement>('[data-dsh-action-refresh]')
    await act(async () => { btn!.click() })
    await act(async () => { await Promise.resolve() })
    // 画布仍在、百分比正常
    expect(container.querySelector('[data-dsh-action-bar]')).not.toBeNull()
    expect(container.querySelector('[data-dsh-action-zoom-percent]')?.textContent).toContain('100')
    await act(async () => root.unmount())
  })
})
