import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ATTR, ACTIVATE_EVENT, PANELS, activate } from '@hundun/dsh-panel-protocol'
import { CanvasController } from '../src/client/canvas/controller.ts'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { MountSupervisor } from '../src/client/canvas/mount-supervisor.ts'

function makeCtx(): any {
  return {
    workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
    emit: () => {},
  }
}

function makeController(): { controller: CanvasController; supervisor: MountSupervisor } {
  const supervisor = new MountSupervisor()
  supervisor.start()
  const controller = new CanvasController(makeCtx(), new CanvasDocumentStore(localStorage))
  controller.start(supervisor)
  return { controller, supervisor }
}

afterEach(() => {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  document.body.innerHTML = ''
})

describe('CanvasController 单标记互斥（T005）', () => {
  it('open 写单一激活标记并广播本面板名', () => {
    const { controller, supervisor } = makeController()
    const seen: string[] = []
    document.addEventListener(ACTIVATE_EVENT, (e) => seen.push((e as CustomEvent<string>).detail))
    controller.open()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
    expect(seen).toContain(PANELS.workspaceCanvas)
    expect(controller.getSnapshot().open).toBe(true)
    controller.dispose()
    supervisor.dispose()
  })

  it('收到其他面板激活事件 → 让位关闭，标记归对方', () => {
    const { controller, supervisor } = makeController()
    controller.open()
    activate(PANELS.helloPanel) // 对方面板真实激活（写标记 + 广播）
    expect(controller.getSnapshot().open).toBe(false)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.helloPanel)
    controller.dispose()
    supervisor.dispose()
  })

  it('自己激活事件不触发让位（open 幂等）', () => {
    const { controller, supervisor } = makeController()
    controller.open()
    controller.open()
    expect(controller.getSnapshot().open).toBe(true)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
    controller.dispose()
    supervisor.dispose()
  })

  it('close 移除自己的标记（仅当标记仍是自己）', () => {
    const { controller, supervisor } = makeController()
    controller.open()
    controller.close()
    expect(controller.getSnapshot().open).toBe(false)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBeNull()
    controller.dispose()
    supervisor.dispose()
  })

  it('dispose 清理标记与监听：之后对方激活不再影响已销毁控制器', () => {
    const { controller, supervisor } = makeController()
    controller.open()
    controller.dispose()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBeNull()
    // 之后对方激活：不崩溃、无残留监听（标记由协议正常写入）。
    activate(PANELS.helloPanel)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.helloPanel)
    supervisor.dispose()
  })
})
