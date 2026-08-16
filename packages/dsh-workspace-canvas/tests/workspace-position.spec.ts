import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { commitWorkspacePosition, readWorkspacePositions } from '../src/client/canvas/workspace-position.ts'

afterEach(() => {
  localStorage.clear()
})

describe('工作区位置持久化（T015/T016）', () => {
  it('commit 写入文档节点（不存在则创建），落盘后可重读', () => {
    const store = new CanvasDocumentStore(localStorage)
    commitWorkspacePosition(store, 'ws-1', { x: 120, y: 40 })
    store.flush() // 立即落盘（防抖默认 500ms，测试不等真实定时器）
    const store2 = new CanvasDocumentStore(localStorage) // 模拟刷新：新实例重读
    expect(readWorkspacePositions(store2)).toEqual({ 'ws-1': { x: 120, y: 40 } })
  })

  it('重复 commit 更新已有节点位置（不产生重复节点）', () => {
    const store = new CanvasDocumentStore(localStorage)
    commitWorkspacePosition(store, 'ws-1', { x: 1, y: 2 })
    commitWorkspacePosition(store, 'ws-1', { x: 9, y: 8 })
    expect(store.read().nodes).toHaveLength(1)
    expect(readWorkspacePositions(store)).toEqual({ 'ws-1': { x: 9, y: 8 } })
  })

  it('read 只返回工作区节点（编排节点不参与布局恢复）', () => {
    const store = new CanvasDocumentStore(localStorage)
    commitWorkspacePosition(store, 'ws-1', { x: 1, y: 2 })
    store.mutate((d) => {
      d.nodes.push({ id: 'n1', kind: 'demo:task', ref: 't1', workspaceId: 'ws-1', position: { x: 0, y: 0 } })
    })
    expect(readWorkspacePositions(store)).toEqual({ 'ws-1': { x: 1, y: 2 } })
  })

  it('空文档 → 空位置表', () => {
    const store = new CanvasDocumentStore(localStorage)
    expect(readWorkspacePositions(store)).toEqual({})
  })

  it('落盘走防抖，flush 可立即持久化（verify: 刷新后位置一致）', () => {
    vi.useFakeTimers()
    try {
      const store = new CanvasDocumentStore(localStorage)
      commitWorkspacePosition(store, 'ws-1', { x: 5, y: 6 })
      expect(localStorage.getItem('dsh.workspaceCanvas.doc.v1')).toBeNull()
      vi.advanceTimersByTime(500)
      const store2 = new CanvasDocumentStore(localStorage)
      expect(readWorkspacePositions(store2)).toEqual({ 'ws-1': { x: 5, y: 6 } })
    } finally {
      vi.useRealTimers()
    }
  })
})
