import { afterEach, describe, expect, it } from 'vitest'
import { CanvasRegistryImpl, validateDocument } from '../src/client/canvas/registry.ts'
import {
  CanvasDocumentStore,
  createEmptyDocument,
  type CanvasNode,
} from '../src/client/canvas/document.ts'

function makeStore(): CanvasDocumentStore {
  return new CanvasDocumentStore(localStorage)
}

function wsNode(id: string, ref: string, x = 0): CanvasNode {
  return { id, kind: 'workspace', ref, position: { x, y: 0 } }
}

function orchNode(id: string, workspaceId: string): CanvasNode {
  return { id, kind: 'demo:task', ref: id, workspaceId, position: { x: 0, y: 0 } }
}

function nodeType(kind: string): any {
  return {
    kind,
    label: { zh: kind, en: kind },
    data: { list: () => ({ subscribe: () => () => {}, getSnapshot: () => [] }) },
    render: () => null,
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('CanvasRegistry 注册 API（T009）', () => {
  it('registerNodeType 成功 / 重复注册抛错 / disposer 注销后可重注册', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    const dispose = reg.registerNodeType(nodeType('demo:task'))
    expect(reg.getNodeType('demo:task')).toBeDefined()
    expect(() => reg.registerNodeType(nodeType('demo:task'))).toThrow(/重复/)
    dispose()
    expect(reg.getNodeType('demo:task')).toBeUndefined()
  })

  it('registerEdgeRule 重复注册抛错', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    const rule: any = { kind: 'demo:assign', label: { zh: '指派', en: 'assign' }, accepts: () => true }
    reg.registerEdgeRule(rule)
    expect(() => reg.registerEdgeRule(rule)).toThrow(/重复/)
  })

  it('registerNodeActions / registerNodeDetailSection 按 order 合并，disposer 移除', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    const a1 = { id: 'a1', label: { zh: '甲', en: 'A' }, run: () => {} }
    const a2 = { id: 'a2', label: { zh: '乙', en: 'B' }, run: () => {} }
    reg.registerNodeActions('workspace', [a2], 20)
    const disposeA1 = reg.registerNodeActions('workspace', [a1], 10)
    expect(reg.mergeActions('workspace').map((a) => a.id)).toEqual(['a1', 'a2'])
    disposeA1()
    expect(reg.mergeActions('workspace').map((a) => a.id)).toEqual(['a2'])

    const s1: any = { label: { zh: '段一', en: 'S1' }, order: 2, render: () => null }
    const s2: any = { label: { zh: '段二', en: 'S2' }, order: 1, render: () => null }
    reg.registerNodeDetailSection('workspace', s1)
    reg.registerNodeDetailSection('workspace', s2)
    expect(reg.mergeSections('workspace')).toEqual([s2, s1])
  })
})

describe('CanvasRegistry mutate 校验（T009）', () => {
  it('合法写入 → 文档更新 + 订阅通知', () => {
    const store = makeStore()
    const reg = new CanvasRegistryImpl(store)
    const seen: number[] = []
    reg.subscribe((d) => seen.push(d.nodes.length))
    reg.mutate((d) => { d.nodes.push(wsNode('w1', 'ws-1')) })
    expect(store.read().nodes).toHaveLength(1)
    expect(seen).toEqual([1])
  })

  it('拒绝无归属节点（no-scope）', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    expect(() => reg.mutate((d) => {
      d.nodes.push({ id: 'n1', kind: 'demo:task', ref: 't1', position: { x: 0, y: 0 } })
    })).toThrow(/no-scope/)
  })

  it('拒绝归属指向不存在的工作区', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    expect(() => reg.mutate((d) => { d.nodes.push(orchNode('n1', 'no-such-ws')) })).toThrow(/不存在的工作区/)
  })

  it('拒绝查重边', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    reg.mutate((d) => {
      d.nodes.push(wsNode('w1', 'ws-1'), orchNode('n1', 'ws-1'), orchNode('n2', 'ws-1'))
      d.edges.push({ id: 'e1', kind: 'link', source: 'n1', target: 'n2' })
    })
    expect(() => reg.mutate((d) => {
      d.edges.push({ id: 'e2', kind: 'link', source: 'n1', target: 'n2' })
    })).toThrow(/重复边/)
  })

  it('拒绝跨工作区 link（crossScope 缺省 false）', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    reg.mutate((d) => {
      d.nodes.push(wsNode('w1', 'ws-1'), wsNode('w2', 'ws-2'))
      d.nodes.push(orchNode('n1', 'ws-1'), orchNode('n2', 'ws-2'))
    })
    expect(() => reg.mutate((d) => {
      d.edges.push({ id: 'e1', kind: 'link', source: 'n1', target: 'n2' })
    })).toThrow(/跨工作区/)
  })

  it('拒绝未知边类型', () => {
    const reg = new CanvasRegistryImpl(makeStore())
    reg.mutate((d) => {
      d.nodes.push(wsNode('w1', 'ws-1'), orchNode('n1', 'ws-1'), orchNode('n2', 'ws-1'))
    })
    expect(() => reg.mutate((d) => {
      d.edges.push({ id: 'e1', kind: 'demo:unknown', source: 'n1', target: 'n2' })
    })).toThrow(/未知边类型/)
  })

  it('validateDocument 对同区 link 放行', () => {
    const doc = createEmptyDocument()
    doc.nodes.push(wsNode('w1', 'ws-1'), orchNode('n1', 'ws-1'), orchNode('n2', 'ws-1'))
    doc.edges.push({ id: 'e1', kind: 'link', source: 'n1', target: 'n2' })
    expect(() => validateDocument(doc, new Map())).not.toThrow()
  })
})
