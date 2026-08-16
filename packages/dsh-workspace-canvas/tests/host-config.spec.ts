import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

interface SectionLike { name: string; order: number }

/** 宿主 apply 的手工测试上下文（无设置服务 → installSettingsSection 不注册）。 */
function makeHostCtx(): any {
  const sections: SectionLike[] = []
  return {
    sections,
    systemPrompt: {
      section: (s: SectionLike): (() => void) => {
        sections.push(s)
        return () => {
          const i = sections.indexOf(s)
          if (i >= 0) sections.splice(i, 1)
        }
      },
    },
    get: () => undefined,
    effect: () => () => {},
    on: () => () => {},
    provide: () => () => {},
    // cordis 反应式注入：无 settings 服务时永不回调（installSettingsSection 静默跳过）。
    inject: () => () => {},
  }
}

describe('host 配置语义（T010）', () => {
  it('缺省配置 → 注册公告（enabled / announceToAgent 默认 true）', () => {
    const ctx = makeHostCtx()
    apply(ctx)
    expect(ctx.sections).toHaveLength(1)
  })

  it('enabled=false → 不注册公告', () => {
    const ctx = makeHostCtx()
    apply(ctx, { enabled: false })
    expect(ctx.sections).toHaveLength(0)
  })

  it('announceToAgent=false → 不注册公告', () => {
    const ctx = makeHostCtx()
    apply(ctx, { enabled: true, announceToAgent: false })
    expect(ctx.sections).toHaveLength(0)
  })

  it('enabled=true + announceToAgent=true → 注册公告', () => {
    const ctx = makeHostCtx()
    apply(ctx, { enabled: true, announceToAgent: true })
    expect(ctx.sections).toHaveLength(1)
  })
})
