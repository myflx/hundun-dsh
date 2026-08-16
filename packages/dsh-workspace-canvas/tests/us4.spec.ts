import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { ContextMenu, MENU_ITEM_ICONS } from '../src/client/canvas/menu.ts'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'
import { workspaceActions } from '../src/client/canvas/workspace-actions.ts'

function makeCtx(): any {
  return {
    workspaces: {
      startSession: vi.fn(() => {}),
      rename: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      archiveSession: vi.fn(() => Promise.resolve()),
    },
  }
}

function wsNode(): any {
  return { id: 'ws:ws-1', kind: 'workspace', ref: 'ws-1', position: { x: 0, y: 0 } }
}

function emptyDoc(): any {
  return { version: 1, nodes: [], edges: [] }
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('工作区内置动作（T024）', () => {
  it('返回 4 个内置动作：详情/重命名/归档/删除（无「进入」）', () => {
    const actions = workspaceActions({ ctx: makeCtx(), store: new CanvasDocumentStore(localStorage), doc: emptyDoc() })
    expect(actions.map((a) => a.id)).toEqual(['detail', 'rename', 'archive', 'delete'])
  })

  it('删除：确认（列出成员数）→ 级联清理 → 官方 delete', async () => {
    const ctx = makeCtx()
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(wsNode(), { id: 'm1', kind: 'hundun:demo', ref: 'm1', workspaceId: 'ws-1', position: { x: 1, y: 1 } })
    })
    const confirm = vi.fn(() => true)
    const actions = workspaceActions({ ctx, store, doc: store.read(), confirm })
    await actions.find((a) => a.id === 'delete')!.run(wsNode(), store.read())
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 个成员'))
    expect(store.read().nodes.some((n) => n.id === 'm1')).toBe(false)
    expect(ctx.workspaces.delete).toHaveBeenCalledWith('ws-1')
  })

  it('删除取消：不级联、不调官方 delete', async () => {
    const ctx = makeCtx()
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => {
      d.nodes.push(wsNode(), { id: 'm1', kind: 'hundun:demo', ref: 'm1', workspaceId: 'ws-1', position: { x: 1, y: 1 } })
    })
    const confirm = vi.fn(() => false)
    const actions = workspaceActions({ ctx, store, doc: store.read(), confirm })
    await actions.find((a) => a.id === 'delete')!.run(wsNode(), store.read())
    expect(store.read().nodes.some((n) => n.id === 'm1')).toBe(true)
    expect(ctx.workspaces.delete).not.toHaveBeenCalled()
  })

  it('删除工作区前归档其全部会话（避免散落到未分组）；确认文案含归档提示', async () => {
    const ctx = makeCtx()
    const store = new CanvasDocumentStore(localStorage)
    store.mutate((d) => { d.nodes.push(wsNode()) })
    const confirm = vi.fn(() => true)
    const actions = workspaceActions({
      ctx, store, doc: store.read(), confirm,
      view: { sessionIds: ['s1', 's2'] },
    })
    await actions.find((a) => a.id === 'delete')!.run(wsNode(), store.read())
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledTimes(2) // 先归档
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('归档其 2 个会话'))
    expect(ctx.workspaces.delete).toHaveBeenCalledWith('ws-1') // 再删除
  })

  it('归档：对该工作区每个会话调 archiveSession（成功逐项归档）', async () => {
    const ctx = makeCtx()
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: ['s1', 's2'] },
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledTimes(2)
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s1')
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s2')
  })

  it('归档失败 → onNotify 提示且不再继续（不静默）', async () => {
    const ctx = makeCtx()
    ctx.workspaces.archiveSession.mockRejectedValueOnce(new Error('gone'))
    const onNotify = vi.fn()
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: ['s1', 's2'] },
      onNotify,
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(onNotify).toHaveBeenCalledWith('归档会话失败：gone')
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledTimes(1) // 失败即停
  })

  it('详情：触发 onRequestDetail(workspaceId)', () => {
    const onRequestDetail = vi.fn()
    const actions = workspaceActions({ ctx: makeCtx(), store: new CanvasDocumentStore(localStorage), doc: emptyDoc(), onRequestDetail })
    actions.find((a) => a.id === 'detail')!.run(wsNode(), emptyDoc())
    expect(onRequestDetail).toHaveBeenCalledWith('ws-1')
  })
})

describe('mergeActions 合并（T023）', () => {
  it('类型所有者 actions 在前，扩展按 order 升序在后', () => {
    const store = new CanvasDocumentStore(localStorage)
    const reg = new CanvasRegistryImpl(store)
    reg.registerNodeType({
      kind: 'demo:x',
      label: { zh: 'x', en: 'x' },
      data: { list: () => ({ subscribe: () => () => {}, getSnapshot: () => [] }) },
      render: () => null as any,
      actions: [{ id: 'owner', label: { zh: '属主', en: 'Owner' }, run: () => {} }],
    })
    reg.registerNodeActions('demo:x', [{ id: 'ext2', label: { zh: '扩2', en: 'E2' }, run: () => {} }], 20)
    reg.registerNodeActions('demo:x', [{ id: 'ext1', label: { zh: '扩1', en: 'E1' }, run: () => {} }], 10)
    expect(reg.mergeActions('demo:x').map((a) => a.id)).toEqual(['owner', 'ext1', 'ext2'])
  })
})

describe('ContextMenu（T023，原生 Menu 组件）', () => {
  /** 查找原生 Menu 项（role=menuitem，按文本）。 */
  const findItem = (text: string): HTMLButtonElement | undefined =>
    [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent?.includes(text)) as HTMLButtonElement | undefined

  it('渲染菜单项；点击后执行动作并关闭', async () => {
    const run = vi.fn()
    const onClose = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(ContextMenu, { x: 10, y: 20, onClose, items: [{ id: 'a', label: '动作A', run }] }))
    })
    const btn = findItem('动作A')
    expect(btn).not.toBeNull()
    await act(async () => { btn!.click() })
    expect(run).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it('渲染系统原生菜单（role=menu）与项图标；danger 项传 danger 标记', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(ContextMenu, {
        x: 10, y: 20, onClose: () => {},
        items: [
          { id: 'rename', label: '重命名', icon: MENU_ITEM_ICONS.rename, run: () => {} },
          { id: 'delete', label: '删除', icon: MENU_ITEM_ICONS.delete, danger: true, run: () => {} },
        ],
      }))
    })
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    const renameItem = findItem('重命名')
    expect(renameItem).not.toBeNull()
    expect(renameItem!.querySelector('svg')).not.toBeNull() // 系统图标
    expect(findItem('删除')).not.toBeNull()
    await act(async () => root.unmount())
  })
})
