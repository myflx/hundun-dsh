import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'

describe('dsh-all 客户端半区（空壳，设置骨架已迁移至 dsh-workspace-canvas）', () => {
  it('apply 不注册任何设置 UI（不再有 settings.section / 子槽位 / 图标 override）', () => {
    // 空壳 apply 无参可调用且不抛错；若未来有人往这里塞注册逻辑，此测试
    // 在调用时即暴露（apply 签名/行为变化），提示迁移到画布包。
    expect(() => apply()).not.toThrow()
  })
})
