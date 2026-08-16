import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasDocumentStore, removeNodeCascade } from '../src/client/canvas/document.ts'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'
import { syncWorkspaceNodes } from '../src/client/canvas/workspace-nodes.ts'
import { CanvasView, partitionPosition } from '../src/client/canvas/CanvasView.tsx'

function ws(id: string, ref: string, x = 0): any {
  return { id, kind: 'workspace', ref, position: { x, y: 0 } }
}
function orch(id: string, workspaceId: string, kind = 'hundun:demo'): any {
  return { id, kind, ref: id, workspaceId, position: { x: 5, y: 7 } }
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('工作区节点投影同步（T018）', () => {
  it('feed 新增工作区 → 自动补建节点', () => {
    const store = new CanvasDocumentStore(localStorage)
    const removed = syncWorkspaceNodes(store, [{ workspaceId: 'ws-1' }, { workspaceId: 'ws-2' }])
    expect(removed).toEqual([])
    expect(store.read().nodes.filter((n) => n.kind === 'workspace').map((n) => n.ref)).toEqual(['ws-1', 'ws-2'])
  })

  it('已存档位置在同步中保留', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.nodes.push(ws('ws:ws-1', 'ws-1', 42)) })
    syncWorkspaceNodes(store, [{ workspaceId: 'ws-1' }])
    expect(store.read().nodes[0]?.position).toEqual({ x: 42, y: 0 })
  })

  it('feed 消失的工作区 → 返回消失列表 + 级联清理其成员节点与边', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(ws('ws:ws-1', 'ws-1'), ws('ws:ws-2', 'ws-2'), orch('m1', 'ws-1'), orch('m2', 'ws-2'))
      d.edges.push({ id: 'e1', kind: 'link', source: 'm1', target: 'm2' })
    })
    const removed = syncWorkspaceNodes(store, [{ workspaceId: 'ws-2' }])
    expect(removed).toEqual(['ws-1'])
    const nodes = store.read().nodes
    expect(nodes.some((n) => n.ref === 'ws-1')).toBe(false)
    expect(nodes.some((n) => n.id === 'm1')).toBe(false) // 级联删除成员
    expect(nodes.some((n) => n.id === 'm2')).toBe(true)  // 保留存活工作区成员
    expect(store.read().edges).toHaveLength(0)            // 边随端点删除
  })
})

describe('删节点连带删边（T020）', () => {
  it('removeNodeCascade 移除节点与其全部边', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(ws('ws:ws-1', 'ws-1'), orch('m1', 'ws-1'), orch('m2', 'ws-1'))
      d.edges.push({ id: 'e1', kind: 'link', source: 'm1', target: 'm2' })
    })
    removeNodeCascade(store, 'm1')
    expect(store.read().nodes.some((n) => n.id === 'm1')).toBe(false)
    expect(store.read().edges.some((e) => e.id === 'e1')).toBe(false)
    expect(store.read().nodes.some((n) => n.id === 'm2')).toBe(true)
  })
})

describe('分区渲染（T019）', () => {
  it('partitionPosition：绝对 = 工作区位置 + 局部坐标', () => {
    expect(partitionPosition({ x: 100, y: 100 }, { x: 5, y: 7 })).toEqual({ x: 105, y: 107 })
  })

  it('编排节点按注册类型渲染在所属工作区区域内', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(ws('ws:ws-1', 'ws-1', 100), orch('m1', 'ws-1'))
    })
    const registry = new CanvasRegistryImpl(store)
    registry.registerNodeType({
      kind: 'hundun:demo',
      label: { zh: '示例', en: 'Demo' },
      data: { list: () => ({ subscribe: () => () => {}, getSnapshot: () => [] }) },
      render: () => createElement('span', null, 'MEMBER'),
    })
    const item = { workspaceId: 'ws-1', title: 'hundun-dsh', path: '/repo/ws-1', sessionIds: [] }
    const snapshot = { items: [item], baselinesReady: true, recentWorkspaceId: undefined }
    const feed = { list: { subscribe: () => () => {}, getSnapshot: () => snapshot } }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feed as any, store, registry, ctx: {} as any, onClose: () => {} }))
    })
    const member = container.querySelector<HTMLElement>('[data-dsh-canvas-member="m1"]')
    expect(member).not.toBeNull()
    expect(member!.style.left).toBe('105px') // 100 + 5
    expect(member!.style.top).toBe('7px') // 0 + 7（ws 助手 y 恒为 0）
    expect(member!.textContent).toContain('MEMBER')
    await act(async () => root.unmount())
  })

  it('未注册类型的节点显示「未知类型」占位', async () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(ws('ws:ws-1', 'ws-1', 10), { id: 'm1', kind: 'unknown:type', ref: 'x', workspaceId: 'ws-1', position: { x: 0, y: 0 } })
    })
    const item = { workspaceId: 'ws-1', title: 'hundun-dsh', path: '/repo/ws-1', sessionIds: [] }
    const snapshot = { items: [item], baselinesReady: true, recentWorkspaceId: undefined }
    const feed = { list: { subscribe: () => () => {}, getSnapshot: () => snapshot } }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasView, { workspaces: feed as any, store, registry: new CanvasRegistryImpl(store), onClose: () => {} }))
    })
    expect(container.textContent).toContain('未知类型')
    await act(async () => root.unmount())
  })
})
