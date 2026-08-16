import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDocumentStore, type CanvasDocument, type CanvasNode } from '../src/client/canvas/document.ts'
import { DetailPanel } from '../src/client/canvas/detail/panel.tsx'
import { WorkspaceDetail } from '../src/client/canvas/detail/workspace-detail.tsx'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'

function node(id: string, kind = 'hundun:demo'): CanvasNode {
  return { id, kind, ref: id, position: { x: 0, y: 0 } }
}

function emptyDoc(): CanvasDocument {
  return { version: 1, nodes: [], edges: [] }
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

async function render(el: any): Promise<{ container: HTMLElement; root: any }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(el) })
  return { container, root }
}

describe('DetailPanel（T026）', () => {
  it('所有者视图在前，扩展区块按 order 升序在后', async () => {
    const store = new CanvasDocumentStore(localStorage)
    const reg = new CanvasRegistryImpl(store)
    reg.registerNodeDetailSection('hundun:demo', { label: { zh: '段一', en: 'S1' }, order: 2, render: () => createElement('span', null, 'BODY-1') })
    reg.registerNodeDetailSection('hundun:demo', { label: { zh: '段二', en: 'S2' }, order: 1, render: () => createElement('span', null, 'BODY-2') })
    const owner = () => createElement('span', null, 'OWNER')
    const { container, root } = await render(createElement(DetailPanel, {
      node: node('m1'),
      doc: emptyDoc(),
      sections: reg.mergeSections('hundun:demo'),
      ownerDetail: owner,
      onClose: () => {},
    }))
    const text = container.textContent ?? ''
    expect(text).toContain('OWNER')
    expect(text.indexOf('段二')).toBeGreaterThan(-1)
    expect(text.indexOf('段一')).toBeGreaterThan(text.indexOf('段二'))
    expect(text).toContain('BODY-2')
    expect(text).toContain('BODY-1')
    await act(async () => root.unmount())
  })

  it('无所有者视图与区块时仍渲染标题栏；关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    const { container, root } = await render(createElement(DetailPanel, {
      node: node('m1'),
      doc: emptyDoc(),
      sections: [],
      onClose,
    }))
    expect(container.querySelector('[data-dsh-canvas-detail]')).not.toBeNull()
    const closeBtn = container.querySelector<HTMLButtonElement>('[data-dsh-detail-close]')
    await act(async () => { closeBtn!.click() })
    expect(onClose).toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})

describe('WorkspaceDetail（T027，clarify Q2）', () => {
  it('显示标题/路径/会话数/最近活跃；不含会话条目列表', async () => {
    const { container, root } = await render(createElement(WorkspaceDetail, {
      view: { title: 'hundun-dsh', path: '/repo/hundun-dsh', sessionIds: ['s1', 's2'] },
      recent: true,
      onJumpSidebar: () => {},
    }))
    const text = container.textContent ?? ''
    expect(text).toContain('hundun-dsh')
    expect(text).toContain('/repo/hundun-dsh')
    expect(text).toContain('2 个')
    expect(text).toContain('最近活跃')
    expect(text).not.toContain('s1') // 不列条目
    await act(async () => root.unmount())
  })

  it('跳转按钮触发 onJumpSidebar', async () => {
    const onJumpSidebar = vi.fn()
    const { container, root } = await render(createElement(WorkspaceDetail, {
      view: { title: 'hundun-dsh', path: '/repo/hundun-dsh', sessionIds: [] },
      recent: false,
      onJumpSidebar,
    }))
    const btn = container.querySelector<HTMLButtonElement>('[data-dsh-jump-sidebar]')
    await act(async () => { btn!.click() })
    expect(onJumpSidebar).toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})
