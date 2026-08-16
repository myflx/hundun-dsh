import { act } from 'react'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { CanvasView } from '../src/client/canvas/CanvasView.tsx'

/** 官方 feed 同形的假 ObservableSnapshot。 */
function fakeFeed(items: unknown[], baselinesReady: boolean) {
  const snapshot = { items, baselinesReady, recentWorkspaceId: undefined }
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
  }
}

function workspaceItem(id: string, title: string): any {
  return { workspaceId: id, title, path: `/repo/${id}`, sessionIds: [] }
}

async function renderView(feed: any, workspaces: any, store: CanvasDocumentStore, onClose: () => void = () => {}, ctx?: any): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(CanvasView, { workspaces, store, onClose, ctx }))
  })
  return { container, root }
}

/** 双击卡片（dispatch dblclick → React onDoubleClick）。 */
function doubleClick(card: HTMLButtonElement): void {
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('CanvasView 状态渲染（T013）', () => {
  it('feed 未就绪 → 加载态', async () => {
    const { container, root } = await renderView(fakeFeed([], false), { list: fakeFeed([], false) }, new CanvasDocumentStore(localStorage))
    expect(container.textContent).toContain('正在加载工作区')
    await act(async () => root.unmount())
  })

  it('无工作区 → 空状态引导', async () => {
    const { container, root } = await renderView(fakeFeed([], true), { list: fakeFeed([], true) }, new CanvasDocumentStore(localStorage))
    expect(container.textContent).toContain('还没有工作区')
    await act(async () => root.unmount())
  })

  it('有工作区 → 卡片渲染（标题/路径/会话数）', async () => {
    const { container, root } = await renderView(
      fakeFeed([workspaceItem('ws-1', 'hundun-dsh')], true),
      { list: fakeFeed([workspaceItem('ws-1', 'hundun-dsh')], true) },
      new CanvasDocumentStore(localStorage),
    )
    expect(container.textContent).toContain('hundun-dsh')
    expect(container.textContent).toContain('/repo/ws-1')
    await act(async () => root.unmount())
  })
})

describe('点击进入新会话（T012/T014，双击进入）', () => {
  it('双击卡片 → startSession(workspaceId)', async () => {
    const startSession = vi.fn(() => Promise.resolve())
    const item = workspaceItem('ws-1', 'hundun-dsh')
    const { container, root } = await renderView(
      fakeFeed([item], true),
      { list: fakeFeed([item], true), startSession },
      new CanvasDocumentStore(localStorage),
    )
    const card = container.querySelector<HTMLButtonElement>('[data-dsh-canvas-card]')
    expect(card).not.toBeNull()
    await act(async () => { doubleClick(card!) })
    expect(startSession).toHaveBeenCalledWith('ws-1')
    await act(async () => root.unmount())
  })

  it('startSession 失败 → 错误提示显示，不崩溃', async () => {
    const startSession = vi.fn(() => Promise.reject(new Error('workspace gone')))
    startSession.mockRejectedValueOnce(new Error('workspace gone'))
    const item = workspaceItem('ws-1', 'hundun-dsh')
    const { container, root } = await renderView(
      fakeFeed([item], true),
      { list: fakeFeed([item], true), startSession },
      new CanvasDocumentStore(localStorage),
    )
    const card = container.querySelector<HTMLButtonElement>('[data-dsh-canvas-card]')
    await act(async () => { doubleClick(card!) })
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('进入会话失败')
    await act(async () => root.unmount())
  })

  it('双击成功 → onClose 被调用（E2E-02：进入会话后退出画布）', async () => {
    const startSession = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    const item = workspaceItem('ws-1', 'hundun-dsh')
    const { container, root } = await renderView(
      fakeFeed([item], true),
      { list: fakeFeed([item], true), startSession },
      new CanvasDocumentStore(localStorage),
      onClose,
    )
    const card = container.querySelector<HTMLButtonElement>('[data-dsh-canvas-card]')
    await act(async () => { doubleClick(card!) })
    await act(async () => { await Promise.resolve() })
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('单击卡片（250ms 后）→ 选中并弹出详情，不进入会话', async () => {
    vi.useFakeTimers()
    const startSession = vi.fn(() => Promise.resolve())
    const store = new CanvasDocumentStore(localStorage)
    // 预置工作区节点投影（明细按 doc 节点渲染）
    store.mutate((d) => { d.nodes.push({ id: 'ws:ws-1', kind: 'workspace', ref: 'ws-1', position: { x: 12, y: 12 } }) })
    const ctx = { workspaces: { startSession, rename: () => Promise.resolve(), delete: () => Promise.resolve(), archiveSession: () => Promise.resolve() } }
    const item = workspaceItem('ws-1', 'hundun-dsh')
    const { container, root } = await renderView(
      fakeFeed([item], true),
      { list: fakeFeed([item], true), startSession },
      store,
      () => {},
      ctx as any,
    )
    const card = container.querySelector<HTMLButtonElement>('[data-dsh-canvas-card]')
    await act(async () => { card!.click() })
    await act(async () => { vi.advanceTimersByTime(300) }) // 单击延迟 250ms
    expect(startSession).not.toHaveBeenCalled() // 单击不进入会话
    expect(container.querySelector('[data-dsh-canvas-detail]')).not.toBeNull() // 自动弹详情
    await act(async () => root.unmount())
    vi.useRealTimers()
  })
})
