import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ATTR, PANELS } from '@hundun/dsh-panel-protocol'
import { CanvasController } from '../src/client/canvas/controller.ts'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { MountSupervisor } from '../src/client/canvas/mount-supervisor.ts'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'
import { ENTRY_SELECTOR, mountSearchButton } from '../src/client/search-button.tsx'

function makeCtx(): any {
  return {
    workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
  }
}

async function drain(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  document.body.innerHTML = ''
})

describe('入口按钮点击 → 画布打开（bugfix 复现）', () => {
  it('点击图标：激活标记写入 + 画布视图容器挂载到对话列', async () => {
    // 布置：按真实 shell 结构（data-slot 标记三列，bugfix 后）。
    const supervisor = new MountSupervisor()
    supervisor.start()
    const controller = new CanvasController(
      makeCtx(),
      new CanvasDocumentStore(localStorage),
      new CanvasRegistryImpl(new CanvasDocumentStore(localStorage)),
    )
    controller.start(supervisor)

    const sidebar = document.createElement('div')
    sidebar.setAttribute('data-slot', 'sidebar')
    const header = document.createElement('div')
    header.className = 'sectionHeader'
    sidebar.appendChild(header)
    document.body.appendChild(sidebar)
    const conversation = document.createElement('div')
    conversation.setAttribute('data-slot', 'conversation')
    const column = document.createElement('div')
    column.setAttribute('data-phase', 'active')
    conversation.appendChild(column)
    document.body.appendChild(conversation)

    // 挂载按钮（act 包裹让 React 提交初始渲染）。
    let disposeButton: () => void = () => {}
    await act(async () => {
      disposeButton = mountSearchButton(controller, supervisor)
    })
    await drain()

    const button = document.querySelector<HTMLButtonElement>(ENTRY_SELECTOR)
    expect(button).not.toBeNull()

    // 点击入口按钮（React 事件需 act 包裹）。
    await act(async () => { button!.click() })

    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
    const view = document.querySelector('[data-dsh-canvas-view]')
    expect(view).not.toBeNull()
    // 画布视图应挂进真实列盒子（contents 槽位的子元素），而非 contents 壳本身。
    expect(view!.parentElement).toBe(column)
    expect(controller.getSnapshot().open).toBe(true)

    disposeButton()
    controller.dispose()
    supervisor.dispose()
  })
})
