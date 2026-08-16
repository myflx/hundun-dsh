import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ATTR, PANELS, activate } from '@hundun/dsh-panel-protocol'
import { HelloPanelController } from '../src/client/panel.tsx'

afterEach(() => {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
  document.body.innerHTML = ''
})

describe('hello 互斥测试面板（T029）', () => {
  it('toggle 打开 → 单一标记为 hello-panel', () => {
    const panel = new HelloPanelController()
    panel.start()
    panel.toggle()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.helloPanel)
    expect(panel.getSnapshot().open).toBe(true)
    panel.dispose()
  })

  it('收到其他面板激活 → 让位关闭，标记归对方', () => {
    const panel = new HelloPanelController()
    panel.start()
    panel.toggle()
    activate(PANELS.workspaceCanvas)
    expect(panel.getSnapshot().open).toBe(false)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
    panel.dispose()
  })

  it('close 移除自己的标记；dispose 后无残留监听', () => {
    const panel = new HelloPanelController()
    panel.start()
    panel.toggle()
    panel.close()
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBeNull()
    panel.dispose()
    activate(PANELS.workspaceCanvas)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe(PANELS.workspaceCanvas)
  })

  it('现行 shell（data-slot=conversation 为 contents 壳）→ 挂载进其子盒子', () => {
    // 复刻现行 shell：display:contents 透传壳 + 真实列盒子子元素（grid 格）。
    const shell = document.createElement('div')
    shell.dataset.slot = 'conversation'
    shell.style.display = 'contents'
    const column = document.createElement('div')
    shell.appendChild(column)
    document.body.appendChild(shell)
    const panel = new HelloPanelController()
    panel.start()
    panel.toggle()
    const container = column.querySelector('[data-dsh-hello-panel]')
    expect(container).not.toBeNull()
    expect(container!.isConnected).toBe(true)
    panel.dispose()
  })
})
