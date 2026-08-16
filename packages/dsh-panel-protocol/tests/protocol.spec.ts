import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ATTR, ACTIVATE_EVENT, PANELS, activate, isActive, onOtherActivate } from '../src/index.ts'

afterEach(() => {
  document.documentElement.removeAttribute(ACTIVE_ATTR)
})

describe('panel protocol: 单一激活标记', () => {
  it('activate 写标记并广播事件（detail = 面板名）', () => {
    const seen: string[] = []
    document.addEventListener(ACTIVATE_EVENT, (e) => seen.push((e as CustomEvent<string>).detail))
    activate('workspace-canvas')
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe('workspace-canvas')
    expect(seen).toEqual(['workspace-canvas'])
  })

  it('isActive 反映当前激活者', () => {
    expect(isActive('a')).toBe(false)
    activate('a')
    expect(isActive('a')).toBe(true)
    expect(isActive('b')).toBe(false)
  })

  it('后写者胜：后者覆盖前者，标记值始终唯一', () => {
    activate('a')
    activate('b')
    expect(isActive('a')).toBe(false)
    expect(isActive('b')).toBe(true)
    expect(document.documentElement.getAttribute(ACTIVE_ATTR)).toBe('b')
  })

  it('onOtherActivate 仅在他人激活时触发；disposer 移除监听', () => {
    let ownEvents = 0
    let otherEvents = 0
    document.addEventListener(ACTIVATE_EVENT, (e) => {
      if ((e as CustomEvent<string>).detail === 'a') ownEvents++
    })
    const disposer = onOtherActivate('a', () => { otherEvents++ })

    activate('a') // 自己激活 → 回调不触发
    expect(ownEvents).toBe(1)
    expect(otherEvents).toBe(0)

    activate('b') // 他人激活 → 回调触发
    expect(otherEvents).toBe(1)

    disposer()
    activate('c')
    expect(otherEvents).toBe(1) // 移除后不再触发
  })

  it('PANELS 常量与协议常量一致', () => {
    expect(PANELS.workspaceCanvas).toBe('workspace-canvas')
    expect(PANELS.helloPanel).toBe('hello-panel')
    expect(ACTIVE_ATTR).toBe('data-dsh-panel-active')
    expect(ACTIVATE_EVENT).toBe('dsh-panel-activate')
  })
})
