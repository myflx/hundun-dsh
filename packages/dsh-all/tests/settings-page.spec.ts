import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, HundunSettingsPage, installNavIconOverride } from '../src/client/index.ts'

afterEach(() => {
  document.body.innerHTML = ''
  document.head.querySelectorAll('style[data-plugin="dsh-all"]').forEach((s) => s.remove())
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

  it('导航 tab 图标替换：hundun-dsh 行打标 + 注入星星样式；disposer 后清理', () => {
    // 模拟官方 shell 导航行（齿轮 SVG + label）
    const nav = document.createElement('nav')
    const btn = document.createElement('button')
    btn.type = 'button'
    const svg = document.createElement('svg')
    const label = document.createElement('span')
    label.textContent = 'hundun-dsh'
    btn.append(svg, label)
    nav.appendChild(btn)
    // 其他行不受影响（如「设置」主 tab）
    const other = document.createElement('button')
    other.type = 'button'
    const otherLabel = document.createElement('span')
    otherLabel.textContent = '设置'
    other.append(document.createElement('svg'), otherLabel)
    nav.appendChild(other)
    document.body.appendChild(nav)

    const dispose = installNavIconOverride()
    expect(btn.getAttribute('data-dsh-hundun-nav')).toBe('')
    expect(other.hasAttribute('data-dsh-hundun-nav')).toBe(false)
    const style = document.head.querySelector('style[data-plugin="dsh-all"]')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('data-dsh-hundun-nav')

    dispose()
    expect(document.head.querySelector('style[data-plugin="dsh-all"]')).toBeNull()
    // 观察器已断开：新出现的 hundun-dsh 行不再被打标
    const btn2 = document.createElement('button')
    const label2 = document.createElement('span')
    label2.textContent = 'hundun-dsh'
    btn2.append(label2)
    document.body.appendChild(btn2)
    expect(btn2.hasAttribute('data-dsh-hundun-nav')).toBe(false)
  })

  it('无 SVG 的按钮即使文本含 hundun-dsh 也不打标（画布卡片误伤 bugfix）', () => {
    // 模拟画布工作区卡片：纯文本 button（无 navIcon svg），路径含 hundun-dsh
    const card = document.createElement('button')
    card.type = 'button'
    const path = document.createElement('span')
    path.textContent = 'D:\\document\\IdeaProjects\\hundun-dsh'
    card.append(path)
    document.body.appendChild(card)

    const dispose = installNavIconOverride()
    expect(card.hasAttribute('data-dsh-hundun-nav')).toBe(false)
    dispose()
  })
})
