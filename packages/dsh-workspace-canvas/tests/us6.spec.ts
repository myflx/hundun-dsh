import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ATTR, PANELS, activate } from '@hundun/dsh-panel-protocol'
import { CanvasController } from '../src/client/canvas/controller.ts'
import { CanvasDocumentStore } from '../src/client/canvas/document.ts'
import { MountSupervisor } from '../src/client/canvas/mount-supervisor.ts'
import { CanvasRegistryImpl } from '../src/client/canvas/registry.ts'

function makeCtx(): any {
  return {
    workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
  }
}

function makeController(): { controller: CanvasController; supervisor: MountSupervisor } {
  const supervisor = new MountSupervisor()
  supervisor.start()
  const controller = new CanvasController(
    makeCtx(),
    new CanvasDocumentStore(localStorage),
    new CanvasRegistryImpl(new CanvasDocumentStore(localStorage)),
  )
  controller.start(supervisor)
  return { controller, supervisor }
}

afterEach(() => {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  document.body.innerHTML = ''
})

describe('互斥完整性（T030）', () => {
  it('并发激活后写者胜：hello 先、画布后 → 画布胜', () => {
    activate(PANELS.helloPanel)
    const { controller, supervisor } = makeController()
    controller.open()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
    controller.dispose()
    supervisor.dispose()
  })

  it('dispose 后无残留标记、注入样式与容器', () => {
    const { controller, supervisor } = makeController()
    controller.open()
    controller.dispose()
    supervisor.dispose()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBeNull()
    expect(document.querySelector('style[data-plugin-css="dsh-workspace-canvas"]')).toBeNull()
    expect(document.querySelector('[data-dsh-canvas-view]')).toBeNull()
  })

  it('刷新后状态收敛：新文档无残留激活标记', () => {
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBeNull()
  })
})
