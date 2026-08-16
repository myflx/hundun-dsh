import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANVAS_ENABLED_KEY, getCanvasEnabled, setCanvasEnabled, subscribeCanvasEnabled } from '../src/client/enabled-store.ts'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('enabled-store（T033 平台限制修正）', () => {
  it('未设置 → null（调用方以组合配置兜底）', () => {
    expect(getCanvasEnabled()).toBeNull()
  })

  it('set → localStorage 持久化 + get 读到', () => {
    setCanvasEnabled(false)
    expect(getCanvasEnabled()).toBe(false)
    expect(localStorage.getItem(CANVAS_ENABLED_KEY)).toBe('false')
    setCanvasEnabled(true)
    expect(getCanvasEnabled()).toBe(true)
    expect(localStorage.getItem(CANVAS_ENABLED_KEY)).toBe('true')
  })

  it('subscribe → 同页广播（CustomEvent）触发', () => {
    const fn = vi.fn()
    const unsub = subscribeCanvasEnabled(fn)
    setCanvasEnabled(false)
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    setCanvasEnabled(true)
    expect(fn).toHaveBeenCalledTimes(1) // 取消订阅后不再触发
  })

  it('subscribe → 跨页 storage 事件触发', () => {
    const fn = vi.fn()
    const unsub = subscribeCanvasEnabled(fn)
    // 模拟其他标签页写入：直接写 localStorage + 派发 storage 事件
    localStorage.setItem(CANVAS_ENABLED_KEY, 'false')
    window.dispatchEvent(new StorageEvent('storage', { key: CANVAS_ENABLED_KEY, newValue: 'false' }))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(getCanvasEnabled()).toBe(false)
    unsub()
  })

  it('subscribe → 无关 key 的 storage 事件不触发', () => {
    const fn = vi.fn()
    const unsub = subscribeCanvasEnabled(fn)
    window.dispatchEvent(new StorageEvent('storage', { key: 'other.key', newValue: 'x' }))
    expect(fn).not.toHaveBeenCalled()
    unsub()
  })
})
