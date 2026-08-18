import { act } from 'react'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { positionsFullyOverlap } from '../src/client/canvas/workspace-position.ts'
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

  it('已存档位置重叠 → 自动避让，两张卡片不同坐标（回归：旧版补建写死 (0,0) 导致重叠「少工作区」）', async () => {
    const store = new CanvasDocumentStore(localStorage)
    // 模拟旧版 bug：两个工作区节点都被补建为 (0,0)
    store.mutate((d) => {
      d.nodes.push(
        { id: 'ws:ws-1', kind: 'workspace', ref: 'ws-1', position: { x: 0, y: 0 } },
        { id: 'ws:ws-2', kind: 'workspace', ref: 'ws-2', position: { x: 0, y: 0 } },
      )
    })
    const { container, root } = await renderView(
      fakeFeed([workspaceItem('ws-1', 'hundun-dsh'), workspaceItem('ws-2', 'other')], true),
      { list: fakeFeed([workspaceItem('ws-1', 'hundun-dsh'), workspaceItem('ws-2', 'other')], true) },
      store,
    )
    const cards = container.querySelectorAll<HTMLButtonElement>('[data-dsh-canvas-card]')
    expect(cards.length).toBe(2)
    const positions = [...cards].map((c) => `${c.style.left},${c.style.top}`)
    expect(new Set(positions).size).toBe(2) // 坐标各不相同 → 不重叠
    expect(container.textContent).toContain('hundun-dsh')
    expect(container.textContent).toContain('other')
    await act(async () => root.unmount())
  })
})

describe('双击进入新会话（T012/T014，双击进入）', () => {
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

describe('拖拽落位防重叠（强行拖到一起也被推挤）', () => {
  it('把 A 拖到 B 的位置 → A 落位被推挤到最近空闲格，落盘位置不重叠', async () => {
    const store = new CanvasDocumentStore(localStorage)
    // 预置两个工作区：A 在 (12,12)，B 在 (228,12)
    store.mutate((d) => {
      d.nodes.push(
        { id: 'ws:ws-a', kind: 'workspace', ref: 'ws-a', position: { x: 12, y: 12 } },
        { id: 'ws:ws-b', kind: 'workspace', ref: 'ws-b', position: { x: 228, y: 12 } },
      )
    })
    const { container, root } = await renderView(
      fakeFeed([workspaceItem('ws-a', 'A'), workspaceItem('ws-b', 'B')], true),
      { list: fakeFeed([workspaceItem('ws-a', 'A'), workspaceItem('ws-b', 'B')], true) },
      store,
    )
    // 模拟拖拽 A 到 B 的位置 (228,12)：pointerdown → pointermove → pointerup
    const cardA = container.querySelector<HTMLButtonElement>('[data-dsh-canvas-card="ws-a"]')!
    // jsdom 的 getBoundingClientRect 全零；mock 成 A 的实际位置，使拖拽偏移可预测
    const rectMock = vi.spyOn(cardA, 'getBoundingClientRect').mockReturnValue({
      x: 12, y: 12, width: 200, height: 80, top: 12, left: 12, right: 212, bottom: 92,
      toJSON: () => ({}),
    } as DOMRect)
    await act(async () => {
      cardA.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 20, clientY: 20 }))
    })
    await act(async () => {
      cardA.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: 228, clientY: 12 }))
    })
    await act(async () => {
      cardA.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 228, clientY: 12 }))
    })
    rectMock.mockRestore()
    // 落盘位置：A 与 B 非「完全重叠」（B 仍在 (228,12)，A 应被推挤到非完全重叠格；
    // 允许部分重叠，仅禁止几乎完全叠在一起）
    const doc = store.read()
    const posA = doc.nodes.find((n) => n.ref === 'ws-a')?.position
    const posB = doc.nodes.find((n) => n.ref === 'ws-b')?.position
    expect(posB).toEqual({ x: 228, y: 12 })
    expect(posA).not.toEqual(posB)
    expect(positionsFullyOverlap(posA!, posB!)).toBe(false)
    // 渲染层两张卡片位置非完全重叠
    const cards = container.querySelectorAll<HTMLButtonElement>('[data-dsh-canvas-card]')
    const lefts = [...cards].map((c) => c.style.left)
    expect(new Set(lefts).size).toBe(2)
    await act(async () => root.unmount())
  })
})
