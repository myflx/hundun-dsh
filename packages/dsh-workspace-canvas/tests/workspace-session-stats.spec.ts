/**
 * 会话统计计算契约测试（003 会话表格）。
 *
 * 验证 workspaceSessionStats：总数 / 活跃（未归档）/ 归档 / 运行中；
 * ctx.sessions 缺失或列表未就绪时运行中安全降级为 0。
 */
import { describe, expect, it } from 'vitest'
import { workspaceSessionStats } from '../src/client/canvas/CanvasView.tsx'

describe('workspaceSessionStats（会话统计计算）', () => {
  it('总数/活跃/归档/运行中正确分账', () => {
    const stats = workspaceSessionStats(
      ['s1', 's2', 's3', 's4'],
      new Set(['s2']), // s2 归档
      {
        sessions: {
          list: {
            getSnapshot: () => ({
              byId: {
                s1: { running: true },
                s3: { running: false },
                // s2、s4 不在列表（运行中视为 false）
              },
            }),
          },
        },
      },
    )
    expect(stats).toEqual({ total: 4, active: 3, archived: 1, running: 1 })
  })

  it('不统计 DSH 用于新会话复用的空白会话', () => {
    const stats = workspaceSessionStats(
      ['blank', 's1', 's2'],
      new Set(['s2']),
      {
        sessions: {
          list: {
            getSnapshot: () => ({
              byId: {
                blank: { blank: true, running: false },
                s1: { blank: false, running: true },
                s2: { blank: false, running: false },
              },
            }),
          },
        },
      },
    )
    expect(stats).toEqual({ total: 2, active: 1, archived: 1, running: 1 })
  })

  it('运行中的会话即使归档也计入运行中', () => {
    const stats = workspaceSessionStats(
      ['s1', 's2'],
      new Set(['s2']),
      {
        sessions: {
          list: {
            getSnapshot: () => ({ byId: { s2: { running: true } } }),
          },
        },
      },
    )
    expect(stats).toEqual({ total: 2, active: 1, archived: 1, running: 1 })
  })

  it('ctx 无 sessions 服务时运行中降级为 0（不抛错）', () => {
    const stats = workspaceSessionStats(['s1'], new Set(), { workspaces: {} })
    expect(stats).toEqual({ total: 1, active: 1, archived: 0, running: 0 })
  })

  it('ctx 为 undefined 时安全降级', () => {
    const stats = workspaceSessionStats(['s1', 's2'], new Set(['s2']), undefined)
    expect(stats).toEqual({ total: 2, active: 1, archived: 1, running: 0 })
  })

  it('Cordis Proxy 未注入时 getter 抛错 → 运行中降级为 0（真机 bugfix 回归）', () => {
    // Cordis ctx 是 Proxy：未 inject 声明时访问 ctx.sessions 直接抛
    // "cannot get property ... without inject"，可选链无法捕获，必须 try/catch。
    const throwingCtx = new Proxy({}, {
      get: (_target, prop) => {
        if (prop === 'sessions') throw new Error('cannot get property "sessions" without inject')
        return undefined
      },
    })
    const stats = workspaceSessionStats(['s1', 's2'], new Set(['s2']), throwingCtx)
    expect(stats).toEqual({ total: 2, active: 1, archived: 1, running: 0 })
  })

  it('空会话列表全为 0', () => {
    const stats = workspaceSessionStats([], new Set(), undefined)
    expect(stats).toEqual({ total: 0, active: 0, archived: 0, running: 0 })
  })
})
