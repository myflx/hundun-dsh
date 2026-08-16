import { afterEach, describe, expect, it } from 'vitest'
import { claimCanvasApply, releaseCanvasApply } from '../src/client/apply-guard.ts'

afterEach(() => {
  releaseCanvasApply()
})

describe('apply-guard（T006）', () => {
  it('首次 claim 成功，重复 claim 被拒（防双挂载）', () => {
    expect(claimCanvasApply()).toBe(true)
    expect(claimCanvasApply()).toBe(false)
    expect(claimCanvasApply()).toBe(false)
  })

  it('release 后恢复可 claim（卸载后可重挂）', () => {
    expect(claimCanvasApply()).toBe(true)
    releaseCanvasApply()
    expect(claimCanvasApply()).toBe(true)
  })
})
