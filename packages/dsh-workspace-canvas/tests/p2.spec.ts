import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { CanvasView } from '../src/client/canvas/CanvasView.tsx'

function feedWith(items: unknown[]): any {
  const snapshot = { items, baselinesReady: true, recentWorkspaceId: undefined }
  return { list: { subscribe: () => () => {}, getSnapshot: () => snapshot } }
}

const ws = { workspaceId: 'ws-1', title: 'hundun-dsh', path: '/repo/ws-1', sessionIds: [] }

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.useRealTimers()
})

describe('P2 视图（T038-T041 集成）', () => {
  it('操作栏放大 → view 尾随防抖持久化到 CanvasDocument.view', async () => {
    vi.useFakeTimers()
    const store = new CanvasDocumentStore(localStorage)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feedWith([ws]), store, onClose: () => {} }))
    })

    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-in]')
    expect(zoomIn).not.toBeNull()
    await act(async () => { zoomIn!.click() })
    expect(store.read().view).toBeUndefined() // 防抖未到

    await act(async () => { vi.advanceTimersByTime(500) })
    expect(store.read().view?.zoom).toBeCloseTo(1.1, 5)

    // 重置视图 → 缩放回 1，平移使工作区集群居中（jsdom 视口 0×0 → x = -cx）
    const reset = container.querySelector<HTMLButtonElement>('[data-dsh-action-reset]')
    await act(async () => { reset!.click() })
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(store.read().view?.zoom).toBe(1)
    // 单卡片 (12,12)→(212,92) 中心 (112,52)；视口 0 → x=-112, y=-52
    expect(store.read().view?.x).toBe(-112)
    expect(store.read().view?.y).toBe(-52)

    await act(async () => root.unmount())
  })

  it('初始 view 从文档恢复（持久化 → 重挂载读取）', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.view = { x: 40, y: -20, zoom: 1.5 } })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feedWith([ws]), store, onClose: () => {} }))
    })
    const viewport = container.querySelector<HTMLElement>('[data-dsh-canvas-viewport]')
    expect(viewport!.style.transform).toBe('translate(40px, -20px) scale(1.5)')
    await act(async () => root.unmount())
  })

  it('无限网格底：固定格距 + 取模跟随平移 + 缩放仅作用于节点层', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.view = { x: 40, y: -20, zoom: 1.5 } })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feedWith([ws]), store, onClose: () => {} }))
    })
    const grid = container.querySelector<HTMLElement>('[data-dsh-canvas-bg]')
    expect(grid).not.toBeNull()
    expect(grid!.getAttribute('data-dsh-canvas-bg')).toBe('grid')
    expect(grid!.style.backgroundSize).toBe('24px 24px')
    // 平移取模：40%24=16；-20%24=-20（负值等价 +4，周期 24 视觉连续）
    expect(grid!.style.backgroundPosition).toBe('16px -20px')
    expect(grid!.style.transform).toBe('') // 网格无 transform，不随缩放/平移变换
    // 缩放操作：网格仍无 transform，节点层 scale 变化（锚点为中心，x/y 同步调整）
    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-action-zoom-in]')
    await act(async () => { zoomIn!.click() })
    expect(grid!.style.transform).toBe('')
    const viewport = container.querySelector<HTMLElement>('[data-dsh-canvas-viewport]')
    expect(viewport!.style.transform).toMatch(/scale\(1\.65/) // 浮点精度：1.5×1.1=1.65（可能带尾差）
    expect(grid!.style.backgroundSize).toBe('24px 24px') // 格距始终固定
    await act(async () => root.unmount())
  })
})
