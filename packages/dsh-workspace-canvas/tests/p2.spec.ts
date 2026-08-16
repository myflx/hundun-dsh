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
  it('工具栏放大 → view 尾随防抖持久化到 CanvasDocument.view', async () => {
    vi.useFakeTimers()
    const store = new CanvasDocumentStore(localStorage)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feedWith([ws]), store, onClose: () => {} }))
    })

    const zoomIn = container.querySelector<HTMLButtonElement>('[data-dsh-zoom-in]')
    expect(zoomIn).not.toBeNull()
    await act(async () => { zoomIn!.click() })
    expect(store.read().view).toBeUndefined() // 防抖未到

    await act(async () => { vi.advanceTimersByTime(500) })
    expect(store.read().view?.zoom).toBeCloseTo(1.1, 5)

    // 重置视图 → view 回到 identity
    const reset = container.querySelector<HTMLButtonElement>('[data-dsh-zoom-reset]')
    await act(async () => { reset!.click() })
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(store.read().view?.zoom).toBe(1)
    expect(store.read().view?.x).toBe(0)

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
})
