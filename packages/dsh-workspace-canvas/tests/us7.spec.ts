import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasRuntime } from '../src/client/runtime.ts'
import { CanvasSettingsCard } from '../src/client/settings.ts'
import { CANVAS_ENABLED_KEY, setCanvasEnabled } from '../src/client/enabled-store.ts'

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('画布设置栏目（T032，本地持久化）', () => {
  it('渲染开关并反映当前值；切换 → localStorage 持久化 + 广播', async () => {
    setCanvasEnabled(true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard))
    })
    const input = container.querySelector<HTMLInputElement>('[data-dsh-canvas-enabled-switch]')
    expect(input).not.toBeNull()
    expect(input!.checked).toBe(true)
    await act(async () => { input!.click() })
    expect(localStorage.getItem(CANVAS_ENABLED_KEY)).toBe('false')
    expect(input!.checked).toBe(false)
    await act(async () => root.unmount())
  })

  it('未设置过 → 默认开启（true）', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard))
    })
    const input = container.querySelector<HTMLInputElement>('[data-dsh-canvas-enabled-switch]')
    expect(input!.checked).toBe(true)
    await act(async () => root.unmount())
  })
})

describe('CanvasRuntime 挂载/卸载（T033）', () => {
  function makeCtx(): any {
    return {
      locale: { register: () => () => {} },
      workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
      effect: () => () => {},
      provide: () => () => {},
      emit: () => {},
      get: () => undefined,
      slots: { inject: () => () => {}, register: () => () => {} },
    }
  }

  it('mount 装配、unmount 全部回收（均幂等）', () => {
    const runtime = new CanvasRuntime(makeCtx())
    expect(runtime.isMounted).toBe(false)
    runtime.mount()
    expect(runtime.isMounted).toBe(true)
    runtime.mount() // 幂等：不重复装配
    runtime.unmount()
    expect(runtime.isMounted).toBe(false)
    runtime.unmount() // 幂等
  })
})
