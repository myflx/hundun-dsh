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

describe('dsh-hello 画布演示节点（T021，事件驱动注册）', () => {
  it('画布已就绪 → 立即注册 hundun:demo 节点类型（render 与 data.list）', () => {
    const registerNodeType = vi.fn((_def: unknown) => () => {})
    const ctx = makeCtx({ registerNodeType })
    const dispose = registerDemoNodeType(ctx)
    expect(registerNodeType).toHaveBeenCalledTimes(1)
    const def = registerNodeType.mock.calls[0]?.[0] as { kind?: string; render?: unknown; data?: { list?: unknown } }
    expect(def?.kind).toBe('hundun:demo')
    expect(typeof def?.render).toBe('function')
    expect(typeof def?.data?.list).toBe('function')
    dispose()
  })

  it('画布缺席 → 不注册；canvas/ready 事件到达后注册（时序竞态修复）', () => {
    const registerNodeType = vi.fn((_def: unknown) => () => {})
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    expect(registerNodeType).not.toHaveBeenCalled()
    // 画布稍后提供 → ready 事件触发注册
    ctx.setCanvas({ registerNodeType })
    expect(registerNodeType).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('画布卸载（canvas/unready）→ 注销；重开（ready）→ 重新注册', () => {
    const registerNodeType = vi.fn((_def: unknown) => () => {})
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    ctx.setCanvas({ registerNodeType })
    expect(registerNodeType).toHaveBeenCalledTimes(1)
    ctx.setCanvas(undefined) // 卸载
    ctx.setCanvas({ registerNodeType }) // 重开 → 幂等重新注册
    expect(registerNodeType).toHaveBeenCalledTimes(2)
    dispose()
  })

  it('画布缺席时 dispose 安全（不抛错）', () => {
    const ctx = makeCtx(undefined)
    const dispose = registerDemoNodeType(ctx)
    expect(() => dispose()).not.toThrow()
  })
})
