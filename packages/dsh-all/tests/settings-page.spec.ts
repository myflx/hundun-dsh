import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, HundunSettingsPage } from '../src/client/index.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('hundun-dsh 设置页骨架（T031）', () => {
  it('apply 注册 settings.section「hundun-dsh」并声明子槽位', () => {
    const register = vi.fn(() => () => {})
    const inject = vi.fn((_key: string, cb: () => unknown) => cb())
    const ctx = { slots: { inject, register }, effect: () => () => {} } as any
    apply(ctx)
    expect(inject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    expect(register).toHaveBeenCalledTimes(1)
    const props = register.mock.calls[0]?.[0]
    expect(props.name).toBe('settings.section')
    expect(props.id).toBe('hundun-dsh')
    expect(props.order).toBe(30)
    expect(props.label).toBe('hundun-dsh')
    expect(props.children).toEqual({ 'hundun.settings.item': { kind: 'list', scope: 'root' } })
  })

  it('页面渲染子槽位内容（栏目区）', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(HundunSettingsPage, {
        close: () => {},
        renderSlot: () => createElement('div', { 'data-dsh-column-mock': '' }, 'COLUMN'),
      }))
    })
    expect(container.textContent).toContain('hundun-dsh')
    expect(container.querySelector('[data-dsh-column-mock]')).not.toBeNull()
    await act(async () => root.unmount())
  })
})
