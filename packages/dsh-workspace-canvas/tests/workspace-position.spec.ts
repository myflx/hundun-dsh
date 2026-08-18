import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import {
  autoLayoutWorkspaces,
  avoidOverlap,
  commitWorkspacePosition,
  overlapRatio,
  positionsFullyOverlap,
  readWorkspacePositions,
} from '../src/client/canvas/workspace-position.ts'

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

  it('autoLayoutWorkspaces 按顺序 GRID 重排（消除重叠、对齐网格）', () => {
    vi.useFakeTimers()
    try {
      const store = new CanvasDocumentStore(localStorage)
      // 预置错位位置
      commitWorkspacePosition(store, 'a', { x: 500, y: 500 })
      commitWorkspacePosition(store, 'b', { x: 510, y: 510 })
      commitWorkspacePosition(store, 'c', { x: 0, y: 0 })
      autoLayoutWorkspaces(store, ['a', 'b', 'c'])
      vi.advanceTimersByTime(600) // 防抖落盘
      const store2 = new CanvasDocumentStore(localStorage)
      const pos = readWorkspacePositions(store2)
      // autoPosition(0)=12,12；autoPosition(1)=228,12；autoPosition(2)=444,12
      expect(pos.a).toEqual({ x: 12, y: 12 })
      expect(pos.b).toEqual({ x: 228, y: 12 })
      expect(pos.c).toEqual({ x: 444, y: 12 })
      // 不重叠（x 间隔 216 > 卡宽 200）
    } finally {
      vi.useRealTimers()
    }
  })

  it('autoLayoutWorkspaces 空数组 = 空操作（不 mutate）', () => {
    const store = new CanvasDocumentStore(localStorage)
    commitWorkspacePosition(store, 'a', { x: 1, y: 2 })
    autoLayoutWorkspaces(store, [])
    expect(readWorkspacePositions(store)).toEqual({ a: { x: 1, y: 2 } })
  })

  it('autoLayoutWorkspaces 成员节点局部坐标不受影响（随工作区移动保留相对位置）', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(
        { id: 'ws:w1', kind: 'workspace', ref: 'w1', position: { x: 100, y: 100 } },
        { id: 'm1', kind: 'hundun:demo', ref: 'r1', workspaceId: 'w1', position: { x: 20, y: 30 } },
      )
    })
    autoLayoutWorkspaces(store, ['w1'])
    const doc = store.read()
    const ws = doc.nodes.find((n) => n.kind === 'workspace')
    const member = doc.nodes.find((n) => n.id === 'm1')
    expect(ws?.position).toEqual({ x: 12, y: 12 }) // 工作区重排
    expect(member?.position).toEqual({ x: 20, y: 30 }) // 成员局部坐标不变
  })
})

describe('拖拽落位防完全重叠（avoidOverlap / positionsFullyOverlap / overlapRatio）', () => {
  it('overlapRatio：同点 1.0；部分重叠按面积占比；不重叠 0', () => {
    const a = { x: 0, y: 0 }
    expect(overlapRatio(a, { x: 0, y: 0 })).toBe(1)          // 完全同点
    expect(overlapRatio(a, { x: 100, y: 0 })).toBe(0.5)      // 水平重叠一半（100/200）
    expect(overlapRatio(a, { x: 0, y: 40 })).toBe(0.5)       // 垂直重叠一半（40/80）
    expect(overlapRatio(a, { x: 200, y: 0 })).toBe(0)        // 刚好卡宽 → 不重叠
    expect(overlapRatio(a, { x: 0, y: 80 })).toBe(0)         // 刚好卡高 → 不重叠
    expect(overlapRatio(a, { x: 300, y: 300 })).toBe(0)
  })

  it('positionsFullyOverlap：重叠面积达到 80% 才视为完全重叠', () => {
    const a = { x: 0, y: 0 }
    expect(positionsFullyOverlap(a, { x: 0, y: 0 })).toBe(true)     // 完全同点
    expect(positionsFullyOverlap(a, { x: 20, y: 0 })).toBe(true)    // 重叠 90% → 避让
    expect(positionsFullyOverlap(a, { x: 100, y: 0 })).toBe(false)  // 重叠 50% → 允许
    expect(positionsFullyOverlap(a, { x: 0, y: 20 })).toBe(false)   // 垂直重叠但不完全同点 → 允许
    expect(positionsFullyOverlap(a, { x: 0, y: 15 })).toBe(true)    // 垂直重叠 81.25% → 避让
    expect(positionsFullyOverlap(a, { x: 200, y: 0 })).toBe(false)  // 不重叠
    expect(positionsFullyOverlap(a, { x: 300, y: 300 })).toBe(false)
  })

  it('avoidOverlap：目标不与任何占用完全重叠 → 原样返回（部分重叠保留）', () => {
    const target = { x: 12, y: 12 }
    // 与 (100,12) 重叠 44%（|12-100|=88，重叠 112/200=0.56；垂直同线）→ 非完全重叠 → 不动
    expect(avoidOverlap(target, [{ x: 100, y: 12 }])).toEqual(target)
    // 完全不重叠 → 不动
    expect(avoidOverlap(target, [{ x: 228, y: 12 }])).toEqual(target)
  })

  it('avoidOverlap：目标与占用完全重叠 → 优先向右下角微移 12px', () => {
    const occupied = [{ x: 12, y: 12 }]
    const result = avoidOverlap({ x: 12, y: 12 }, occupied)
    expect(positionsFullyOverlap(result, occupied[0])).toBe(false)
    expect(result).toEqual({ x: 24, y: 24 })
  })

  it('avoidOverlap：重叠超过 80% 但不完全同点 → 仍然微移到阈值以下', () => {
    const occupied = [{ x: 20, y: 0 }]
    const result = avoidOverlap({ x: 0, y: 0 }, occupied)
    expect(positionsFullyOverlap(result, occupied[0])).toBe(false)
    expect(Math.abs(result.x) <= 24 && Math.abs(result.y) <= 24).toBe(true)
  })

  it('avoidOverlap：多个占用时跳过被占格，找到第一个非完全重叠格', () => {
    const occupied = [
      { x: 12, y: 12 },   // 目标格
      { x: 228, y: 12 },  // 右一格
      { x: 12, y: 124 },  // 下一格
      { x: 228, y: 124 }, // 右下格
    ]
    const result = avoidOverlap({ x: 12, y: 12 }, occupied)
    expect(occupied.some((o) => positionsFullyOverlap(result, o))).toBe(false)
    expect(result).not.toEqual({ x: 12, y: 12 })
    expect(Math.abs(result.x - 12) <= 12 || Math.abs(result.y - 12) <= 12).toBe(true)
  })
})
