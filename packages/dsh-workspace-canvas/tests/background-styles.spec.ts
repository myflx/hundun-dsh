/**
 * 画布背景风格注册表契约测试（004-canvas-layout-styles）。
 */
import { describe, expect, it } from 'vitest'
import {
  CANVAS_BACKGROUND_STYLES,
  DEFAULT_BACKGROUND_ID,
  getCanvasBackgroundStyle,
} from '../src/client/canvas/background-styles.ts'

describe('背景风格注册表（004）', () => {
  it('注册 6 种风格且 id 唯一、含默认「网格」', () => {
    const ids = CANVAS_BACKGROUND_STYLES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_BACKGROUND_ID)
    expect(ids).toEqual(['grid', 'dots', 'solid', 'gradient', 'dark-grid', 'blueprint'])
  })

  it('每种风格有名称、说明与背景渲染参数', () => {
    for (const style of CANVAS_BACKGROUND_STYLES) {
      expect(style.name).not.toBe('')
      expect(style.description).not.toBe('')
      expect(style.backgroundImage).not.toBe('')
      expect(style.backgroundColor).not.toBe('')
      expect(typeof style.followPan).toBe('boolean')
    }
  })

  it('图案类风格（网格/点阵/暗色网格/蓝图）平移取模跟随，铺满类（纯色/渐变）固定', () => {
    expect(getCanvasBackgroundStyle('grid').followPan).toBe(true)
    expect(getCanvasBackgroundStyle('dots').followPan).toBe(true)
    expect(getCanvasBackgroundStyle('dark-grid').followPan).toBe(true)
    expect(getCanvasBackgroundStyle('blueprint').followPan).toBe(true)
    expect(getCanvasBackgroundStyle('solid').followPan).toBe(false)
    expect(getCanvasBackgroundStyle('gradient').followPan).toBe(false)
  })

  it('未知/损坏值回退默认「网格」，不崩', () => {
    expect(getCanvasBackgroundStyle('bogus').id).toBe(DEFAULT_BACKGROUND_ID)
    expect(getCanvasBackgroundStyle(null).id).toBe(DEFAULT_BACKGROUND_ID)
    expect(getCanvasBackgroundStyle(undefined).id).toBe(DEFAULT_BACKGROUND_ID)
  })
})
