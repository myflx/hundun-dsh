import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasRuntime } from '../src/client/runtime.ts'
import { CanvasSettingsCard } from '../src/client/settings.ts'

/** 假 settings scope（getSnapshot/subscribe/set）。 */
function fakeScope(value: { enabled?: boolean } = { enabled: true }) {
  let current = value
  const listeners = new Set<() => void>()
  const set = vi.fn((field: string, v: unknown) => {
    current = { ...current, [field]: v }
    for (const listener of listeners) listener()
  })
  return {
    getSnapshot: () => ({ value: current }),
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    set,
    unset: vi.fn(),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('画布设置栏目（T032）', () => {
  it('渲染开关并反映当前值；切换 → scope.set(enabled, 反值)', async () => {
    const scope = fakeScope({ enabled: true })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard, { scope: scope as any }))
    })
    const input = container.querySelector<HTMLInputElement>('[data-dsh-canvas-enabled-switch]')
    expect(input).not.toBeNull()
    expect(input!.checked).toBe(true)
    await act(async () => { input!.click() })
    expect(scope.set).toHaveBeenCalledWith('enabled', false)
    await act(async () => root.unmount())
  })
})

describe('CanvasRuntime 挂载/卸载（T033）', () => {
  function makeCtx(): any {
    return {
      locale: { register: () => () => {} },
      workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], baselinesReady: true }) } },
      effect: () => () => {},
      provide: () => {},
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
