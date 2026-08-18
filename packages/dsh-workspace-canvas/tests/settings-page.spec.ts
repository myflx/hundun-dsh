import { describe, expect, it, vi } from 'vitest'
import { installCanvasNavIconOverride, registerCanvasSettingsPage } from '../src/client/settings.ts'

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
    expect(props.label).toBe('工作区')
    expect(props.inject).toEqual(expect.any(Function))
    // 页面组件直接渲染分组内容（自持，无子槽位）。
    expect(register.mock.calls[0]?.[1]).toEqual(expect.any(Function))
    // disposer 幂等可调用
    expect(disposer).toEqual(expect.any(Function))
    disposer()
  })
})

describe('工作区设置导航图标', () => {
  it('只标记设置导航按钮，不标记同名工作区卡片', () => {
    document.body.innerHTML = '<button id="nav"><svg></svg>工作区</button><button id="card">工作区</button>'
    const dispose = installCanvasNavIconOverride()
    expect(document.querySelector('#nav')?.hasAttribute('data-dsh-workspace-nav')).toBe(true)
    expect(document.querySelector('#card')?.hasAttribute('data-dsh-workspace-nav')).toBe(false)
    expect(document.querySelector('style[data-plugin="dsh-workspace-canvas"]')).not.toBeNull()
    dispose()
    expect(document.querySelector('#nav')?.hasAttribute('data-dsh-workspace-nav')).toBe(false)
    expect(document.querySelector('style[data-plugin="dsh-workspace-canvas"]')).toBeNull()
  })
})
