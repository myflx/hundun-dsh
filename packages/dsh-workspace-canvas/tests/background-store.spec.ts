/**
 * 画布背景风格持久化契约测试（004-canvas-layout-styles，与 enabled-store 同模式）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  CANVAS_BACKGROUND_KEY,
  getCanvasBackgroundId,
  setCanvasBackgroundId,
  subscribeCanvasBackgroundId,
} from '../src/client/background-store.ts'

afterEach(() => {
  localStorage.clear()
})

describe('背景风格持久化（004）', () => {
  it('未设置 → null（调用方回退默认）', () => {
    expect(getCanvasBackgroundId()).toBeNull()
  })

  it('写入 → localStorage 持久化 + 订阅回调', () => {
    const calls: string[] = []
    const unsub = subscribeCanvasBackgroundId(() => calls.push(getCanvasBackgroundId() ?? ''))
    setCanvasBackgroundId('dots')
    expect(localStorage.getItem(CANVAS_BACKGROUND_KEY)).toBe('dots')
    expect(getCanvasBackgroundId()).toBe('dots')
    expect(calls).toContain('dots')
    // 再切一次
    setCanvasBackgroundId('blueprint')
    expect(getCanvasBackgroundId()).toBe('blueprint')
    expect(calls).toContain('blueprint')
    unsub()
    // 退订后不再回调
    const before = calls.length
    setCanvasBackgroundId('solid')
    expect(calls.length).toBe(before)
  })
})
