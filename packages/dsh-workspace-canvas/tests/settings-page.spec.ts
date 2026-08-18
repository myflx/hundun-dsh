import { describe, expect, it, vi } from 'vitest'
import { registerCanvasSettingsPage } from '../src/client/settings.ts'

describe('画布设置页自持注册（settings.section，骨架迁移自 dsh-all）', () => {
  it('注册 settings.section「workspace-canvas」页面（不再依赖 dsh-all 子槽位）', () => {
    const register = vi.fn(() => () => {})
    const inject = vi.fn((_key: string, cb: () => unknown) => cb())
    const ctx = { slots: { inject, register } } as any
    const disposer = registerCanvasSettingsPage(ctx)
    expect(inject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    expect(register).toHaveBeenCalledTimes(1)
    const props = register.mock.calls[0]?.[0]
    expect(props.name).toBe('settings.section')
    expect(props.id).toBe('workspace-canvas')
    expect(props.order).toBe(30)
    expect(props.label).toBe('画布')
    expect(props.inject).toEqual(expect.any(Function))
    // 页面组件直接渲染分组内容（自持，无子槽位）。
    expect(register.mock.calls[0]?.[1]).toEqual(expect.any(Function))
    // disposer 幂等可调用
    expect(disposer).toEqual(expect.any(Function))
    disposer()
  })
})
