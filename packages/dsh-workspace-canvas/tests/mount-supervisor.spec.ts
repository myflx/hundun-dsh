import { describe, expect, it } from 'vitest'
import { CanvasController } from '../src/client/canvas/controller.ts'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { MountSupervisor } from '../src/client/canvas/mount-supervisor.ts'
import { ENTRY_SELECTOR, mountSearchButton } from '../src/client/search-button.tsx'

function makeCtx(): any {
  return {
    workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
    emit: () => {},
  }
}

/** 触发一次 DOM 变更并等待微任务批处理 flush（观察器回调 → flush 两级微任务）。 */
async function flush(): Promise<void> {
  document.body.appendChild(document.createElement('div'))
  await Promise.resolve()
  await Promise.resolve()
}

/** 仅排空两级微任务（不触发新变更）。 */
async function drain(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('MountSupervisor（T007）', () => {
  it('注册的 ensure 在 DOM 变更后批量执行一次', async () => {
    const s = new MountSupervisor()
    s.start()
    let calls = 0
    const unregister = s.register(() => { calls++ })
    await flush()
    expect(calls).toBe(1)
    unregister()
    s.dispose()
  })

  it('dispose 后不再触发', async () => {
    const s = new MountSupervisor()
    s.start()
    let calls = 0
    s.register(() => { calls++ })
    s.dispose()
    await flush()
    expect(calls).toBe(0)
  })
})

describe('画布入口按钮自愈（T007）', () => {
  it('侧边栏标题行出现后按钮容器自动插入；容器被挤出后自动重插', async () => {
    const supervisor = new MountSupervisor()
    supervisor.start()
    const controller = new CanvasController(makeCtx(), new CanvasDocumentStore(localStorage))
    const dispose = mountSearchButton(controller, supervisor)

    // 构造侧边栏结构（搜索行所在标题行）。
    const sidebar = document.createElement('div')
    sidebar.setAttribute('data-pane', 'sidebar')
    const header = document.createElement('div')
    header.className = 'sectionHeader'
    sidebar.appendChild(header)
    document.body.appendChild(sidebar)
    await drain()

    const root = document.querySelector<HTMLElement>('[data-dsh-canvas-entry-root]')
    expect(root).not.toBeNull()
    expect(header.contains(root)).toBe(true)

    // 模拟 React 重渲染把容器挤掉：清空标题行 → 触发变更 → 自动重插。
    header.innerHTML = ''
    await flush()
    expect(header.querySelector('[data-dsh-canvas-entry-root]')).not.toBeNull()
    expect(document.querySelector(ENTRY_SELECTOR)).toBeDefined() // 按钮元素树存在

    dispose()
    expect(header.querySelector('[data-dsh-canvas-entry-root]')).toBeNull() // 卸载移除容器
    expect(document.querySelector('style[data-plugin-css="dsh-workspace-canvas-entry"]')).toBeNull() // 卸载移除注入样式

    supervisor.dispose()
    controller.dispose()
  })
})
