import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DOC_BAK_KEY,
  DOC_STORAGE_KEY,
  CanvasDocumentStore,
  createEmptyDocument,
  migrate,
  type CanvasDocument,
} from '../src/client/canvas/document.ts'

function docWith(nodes = 1): CanvasDocument {
  const d = createEmptyDocument()
  for (let i = 0; i < nodes; i++) {
    d.nodes.push({ id: `n${i}`, kind: 'workspace', ref: `w${i}`, position: { x: i * 10, y: 0 } })
  }
  return d
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('CanvasDocumentStore（T008）', () => {
  it('mutate → 防抖落盘 → 重读一致（roundtrip）', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.nodes.push({ id: 'a', kind: 'workspace', ref: 'w1', position: { x: 1, y: 2 } }) })
    expect(localStorage.getItem(DOC_STORAGE_KEY)).toBeNull() // 防抖未到
    vi.advanceTimersByTime(500)
    const raw = localStorage.getItem(DOC_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const store2 = new CanvasDocumentStore(localStorage)
    expect(store2.read().nodes).toHaveLength(1)
    expect(store2.read().nodes[0]?.position).toEqual({ x: 1, y: 2 })
  })

  it('连续 mutate 合并为一次落盘（防抖）', () => {
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.nodes.push({ id: 'a', kind: 'workspace', ref: 'w1', position: { x: 1, y: 2 } }) })
    vi.advanceTimersByTime(200)
    store.mutate((d) => { d.nodes.push({ id: 'b', kind: 'workspace', ref: 'w2', position: { x: 3, y: 4 } }) })
    vi.advanceTimersByTime(500)
    const store2 = new CanvasDocumentStore(localStorage)
    expect(store2.read().nodes).toHaveLength(2)
  })

  it('损坏 JSON → recovered=true + .bak 备份 + 空文档启动', () => {
    localStorage.setItem(DOC_STORAGE_KEY, '{corrupt json!!!')
    const store = new CanvasDocumentStore(localStorage)
    expect(store.recovered).toBe(true)
    expect(store.read().nodes).toHaveLength(0)
    expect(localStorage.getItem(DOC_BAK_KEY)).toBe('{corrupt json!!!')
  })

  it('版本不支持的文档同样走恢复路径', () => {
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify({ version: 99, nodes: [], edges: [] }))
    const store = new CanvasDocumentStore(localStorage)
    expect(store.recovered).toBe(true)
  })

  it('配额满 → 只读降级（quotaExceeded 一次性标志），内存文档不丢', () => {
    const failing: Storage = {
      ...localStorage,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
    }
    const store = new CanvasDocumentStore(failing)
    store.mutate((d) => { d.nodes.push({ id: 'a', kind: 'workspace', ref: 'w1', position: { x: 1, y: 2 } }) })
    vi.advanceTimersByTime(500)
    expect(store.quotaExceeded).toBe(true)
    expect(store.read().nodes).toHaveLength(1) // 内存文档仍在
  })

  it('subscribe 在 mutate 后收到新文档引用', () => {
    const store = new CanvasDocumentStore(localStorage)
    const seen: number[] = []
    store.subscribe((d) => seen.push(d.nodes.length))
    store.mutate((d) => { d.nodes.push({ id: 'a', kind: 'workspace', ref: 'w1', position: { x: 1, y: 2 } }) })
    expect(seen).toEqual([1])
  })

  it('migrate 对 v1 透传（预留迁移链）', () => {
    const d = docWith(2)
    expect(migrate(d)).toBe(d)
  })
})
