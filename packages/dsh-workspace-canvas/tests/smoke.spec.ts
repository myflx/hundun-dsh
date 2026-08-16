import { describe, expect, it } from 'vitest'

/** 基建冒烟：确认 vitest + jsdom 环境就绪（真实单测自 T005 起逐项补充）。 */
describe('test infrastructure smoke', () => {
  it('jsdom 环境可用', () => {
    expect(typeof document).toBe('object')
    expect(document.documentElement).toBeDefined()
  })

  it('测试收集器可运行', () => {
    expect(1 + 1).toBe(2)
  })
})
