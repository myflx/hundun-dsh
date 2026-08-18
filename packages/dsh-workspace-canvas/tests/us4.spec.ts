import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { ContextMenu, MENU_ITEM_ICONS } from '../src/client/canvas/menu.ts'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'
import { ConfirmDialog } from '../src/client/canvas/CanvasView.tsx'
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
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '删除工作区', description: expect.stringContaining('1 个成员'), confirmLabel: '删除（级联）', danger: true }))
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
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('归档其 2 个会话') }))
    expect(ctx.workspaces.delete).toHaveBeenCalledWith('ws-1') // 再删除
  })

  it('全部归档：二次确认（列出未归档会话数）→ 逐项调 archiveSession', async () => {
    const ctx = makeCtx()
    const confirm = vi.fn(() => true)
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: ['s1', 's2'] },
      confirm,
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '全部归档', description: '确认归档全部 2 个会话？', confirmLabel: '全部归档' }))
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledTimes(2)
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s1')
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s2')
  })

  it('全部归档：已归档会话不计入确认数量，且不重复归档（未归档数语义）', async () => {
    const ctx = makeCtx()
    const confirm = vi.fn(() => true)
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: ['s1', 's2', 's3'], archivedSessionIds: ['s2'] },
      confirm,
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ description: '确认归档全部 2 个会话？' }))
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledTimes(2)
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s1')
    expect(ctx.workspaces.archiveSession).toHaveBeenCalledWith('s3')
  })

  it('全部归档取消：不调官方 archiveSession', async () => {
    const ctx = makeCtx()
    const confirm = vi.fn(() => false)
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: ['s1', 's2'] },
      confirm,
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(confirm).toHaveBeenCalled()
    expect(ctx.workspaces.archiveSession).not.toHaveBeenCalled()
  })

  it('全部归档：无会话时直接跳过（不弹确认、不调 API）', async () => {
    const ctx = makeCtx()
    const confirm = vi.fn(() => true)
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: [] },
      confirm,
    })
    await actions.find((a) => a.id === 'archive')!.run(wsNode(), emptyDoc())
    expect(confirm).not.toHaveBeenCalled()
    expect(ctx.workspaces.archiveSession).not.toHaveBeenCalled()
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
      confirm: () => true,
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

  it('重命名：弹窗初始值为工作区标题（非工作区 ID）；提交后调官方 rename', async () => {
    const ctx = makeCtx()
    const prompt = vi.fn(() => '新名字')
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: [], title: '我的工作区', path: '/home/user/proj' },
      prompt,
    })
    await actions.find((a) => a.id === 'rename')!.run(wsNode(), emptyDoc())
    expect(prompt).toHaveBeenCalledWith('请输入新的工作区标题', '我的工作区')
    expect(ctx.workspaces.rename).toHaveBeenCalledWith('ws-1', '新名字')
  })

  it('重命名：无标题时初始值为目录名（默认目录名称），仍不显示工作区 ID', async () => {
    const ctx = makeCtx()
    const prompt = vi.fn(() => null)
    const actions = workspaceActions({
      ctx,
      store: new CanvasDocumentStore(localStorage),
      doc: emptyDoc(),
      view: { sessionIds: [], title: '', path: '/home/user/proj' },
      prompt,
    })
    await actions.find((a) => a.id === 'rename')!.run(wsNode(), emptyDoc())
    expect(prompt).toHaveBeenCalledWith('请输入新的工作区标题', 'proj')
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

describe('ConfirmDialog（DSH 系统样式二次确认，同官方删除确认）', () => {
  /** 按可见文本找 footer 按钮（Modal 关闭 × 是纯图标，不含文本）。 */
  const findButton = (text: string): HTMLButtonElement | undefined =>
    [...document.body.querySelectorAll('button')].find((el) => el.textContent?.trim() === text) as HTMLButtonElement | undefined

  it('渲染系统 Modal：标题 + 描述 + 取消/确认按钮；取消 → onResolve(false)', async () => {
    const onResolve = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(ConfirmDialog, {
        request: { title: '全部归档', description: '确认归档全部 2 个会话？', confirmLabel: '全部归档' },
        onResolve,
      }))
    })
    expect(document.body.textContent).toContain('全部归档')
    expect(document.body.textContent).toContain('确认归档全部 2 个会话？')
    expect(findButton('取消')).not.toBeNull()
    expect(findButton('全部归档')).not.toBeNull()
    await act(async () => { findButton('取消')!.click() })
    expect(onResolve).toHaveBeenCalledWith(false)
    await act(async () => root.unmount())
  })

  it('确认按钮 → onResolve(true)；danger 请求确认按钮带系统错误色（参考删除）', async () => {
    const onResolve = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(ConfirmDialog, {
        request: { title: '删除工作区', description: '确定删除该工作区？', confirmLabel: '删除（级联）', danger: true },
        onResolve,
      }))
    })
    const confirmBtn = findButton('删除（级联）')
    expect(confirmBtn).not.toBeNull()
    expect(confirmBtn!.style.color).toBe('var(--dsw-alias-state-error-primary)')
    await act(async () => { confirmBtn!.click() })
    expect(onResolve).toHaveBeenCalledWith(true)
    await act(async () => root.unmount())
  })
})
