import { describe, expect, it, vi } from 'vitest'
import { registerDemoNodeType } from '../src/client/canvas-demo-node.tsx'

describe('dsh-hello 画布演示节点（T021）', () => {
  it('画布存在时注册 hundun:demo 节点类型（含 render 与 data.list）', () => {
    const registerNodeType = vi.fn((_def: unknown) => () => {})
    const ctx = { get: (key: string) => (key === 'canvas' ? { registerNodeType } : undefined) } as any
    const dispose = registerDemoNodeType(ctx)
    expect(registerNodeType).toHaveBeenCalledTimes(1)
    const def = registerNodeType.mock.calls[0]?.[0] as { kind?: string; render?: unknown; data?: { list?: unknown } }
    expect(def?.kind).toBe('hundun:demo')
    expect(typeof def?.render).toBe('function')
    expect(typeof def?.data?.list).toBe('function')
    dispose()
  })

  it('画布缺席时安全跳过（不抛错、不注册）', () => {
    const ctx = { get: () => undefined } as any
    expect(() => registerDemoNodeType(ctx)).not.toThrow()
  })
})
