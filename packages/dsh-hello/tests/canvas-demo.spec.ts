import { describe, expect, it, vi } from 'vitest'
import { registerDemoNodeType } from '../src/client/canvas-demo-node.tsx'

/** 构造含 on/emit/get 的假 ctx（画布服务可插拔）。 */
function makeCtx(canvas?: unknown) {
  let current = canvas
  const listeners = new Map<string, Set<() => void>>()
  const ctx = {
    get: (key: string) => (key === 'canvas' ? current : undefined),
    on: (name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name)!.add(fn)
      return () => { listeners.get(name)!.delete(fn) }
    },
    emit: (name: string) => {
      for (const fn of listeners.get(name) ?? []) fn()
    },
    /** 测试辅助：模拟画布服务提供/卸载。 */
    setCanvas: (v: unknown) => { current = v; ctx.emit(v === undefined ? 'canvas/unready' : 'canvas/ready') },
  } as any
  return ctx
}

/** 画布服务 mock（type/actions/section 三类注册）。 */
function makeCanvas() {
  return {
    registerNodeType: vi.fn((_def: unknown) => () => {}),
    registerNodeActions: vi.fn((_kind: string, _actions: unknown[], _order?: number) => () => {}),
    registerNodeDetailSection: vi.fn((_kind: string, _section: unknown) => () => {}),
  }
}

describe('dsh-hello 画布演示节点（T021，事件驱动注册）', () => {
  it('画布已就绪 → 注册节点类型 + 扩展动作 + 扩展明细区块', () => {
    const canvas = makeCanvas()
    const ctx = makeCtx(canvas)
    const dispose = registerDemoNodeType(ctx)
    expect(canvas.registerNodeType).toHaveBeenCalledTimes(1)
    expect(canvas.registerNodeActions).toHaveBeenCalledTimes(1)
    expect(canvas.registerNodeDetailSection).toHaveBeenCalledTimes(1)
    const def = canvas.registerNodeType.mock.calls[0]?.[0] as { kind?: string; render?: unknown; data?: { list?: unknown }; detail?: unknown }
    expect(def?.kind).toBe('hundun:demo')
    expect(typeof def?.render).toBe('function')
    expect(typeof def?.data?.list).toBe('function')
    expect(typeof def?.detail).toBe('function') // E2E-14：内置明细
    const actions = canvas.registerNodeActions.mock.calls[0]?.[1] as unknown[]
    expect(Array.isArray(actions)).toBe(true)
    expect((actions[0] as { id?: string })?.id).toBe('demo-activate') // E2E-12：扩展动作
    const section = canvas.registerNodeDetailSection.mock.calls[0]?.[1] as { label?: { zh?: string } }
    expect(section?.label?.zh).toBe('演示区块') // E2E-14：扩展区块
    dispose()
  })

  it('画布缺席 → 不注册；canvas/ready 事件到达后注册（时序竞态修复）', () => {
    const canvas = makeCanvas()
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    expect(canvas.registerNodeType).not.toHaveBeenCalled()
    // 画布稍后提供 → ready 事件触发注册
    ctx.setCanvas(canvas)
    expect(canvas.registerNodeType).toHaveBeenCalledTimes(1)
    expect(canvas.registerNodeActions).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('画布卸载（canvas/unready）→ 注销；重开（ready）→ 重新注册（幂等）', () => {
    const canvas = makeCanvas()
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    ctx.setCanvas(canvas)
    expect(canvas.registerNodeType).toHaveBeenCalledTimes(1)
    ctx.setCanvas(undefined) // 卸载
    ctx.setCanvas(canvas) // 重开
    expect(canvas.registerNodeType).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('画布缺席时 dispose 安全（不抛错）', () => {
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    expect(() => dispose()).not.toThrow()
  })
})
