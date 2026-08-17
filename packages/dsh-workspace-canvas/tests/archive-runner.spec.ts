/**
 * 自动归档判定契约测试（005-workspace-auto-archive）。
 *
 * 双条件 OR（闲置天数 / 未归档数超上限）、跳过运行中、跳过无 updatedAt、幂等。
 */
import { describe, expect, it } from 'vitest'
import { selectSessionsToArchive, type WorkspaceArchiveInput } from '../src/client/archive-runner.ts'

const DAY = 24 * 60 * 60 * 1000
/** now = 2026-01-01T00:00:00Z。 */
const NOW = Date.UTC(2026, 0, 1)

function input(
  unarchived: string[],
  byId: Record<string, { running?: boolean; updatedAt?: number } | undefined>,
): WorkspaceArchiveInput {
  return { workspaceId: 'w', unarchivedSessionIds: unarchived, sessionById: byId }
}

describe('selectSessionsToArchive（双条件 OR）', () => {
  it('未启用 → 不归档任何会话', () => {
    const result = selectSessionsToArchive(
      input(['s1'], { s1: { updatedAt: NOW - 100 * DAY } }),
      { enabled: false, idleDays: 30, maxSessions: 0 },
      NOW,
    )
    expect(result).toEqual([])
  })

  it('闲置超期 → 归档；未超期保留', () => {
    const result = selectSessionsToArchive(
      input(['s_old', 's_new'], {
        s_old: { updatedAt: NOW - 40 * DAY },
        s_new: { updatedAt: NOW - 5 * DAY },
      }),
      { enabled: true, idleDays: 30, maxSessions: 0 },
      NOW,
    )
    expect(result).toEqual(['s_old'])
  })

  it('未归档数超上限 → 归档最旧差额', () => {
    const result = selectSessionsToArchive(
      input(['a', 'b', 'c', 'd'], {
        a: { updatedAt: NOW - 10 * DAY },
        b: { updatedAt: NOW - 8 * DAY },
        c: { updatedAt: NOW - 6 * DAY },
        d: { updatedAt: NOW - 4 * DAY },
      }),
      { enabled: true, idleDays: 365, maxSessions: 2 },
      NOW,
    )
    expect(result).toEqual(['a', 'b']) // 最旧 2 个（差额 2）
  })

  it('跳过运行中会话（闲置与超限均不归档）', () => {
    const result = selectSessionsToArchive(
      input(['s_running_old', 's_idle'], {
        s_running_old: { running: true, updatedAt: NOW - 100 * DAY },
        s_idle: { updatedAt: NOW - 40 * DAY },
      }),
      { enabled: true, idleDays: 30, maxSessions: 0 },
      NOW,
    )
    expect(result).toEqual(['s_idle']) // 运行中的超期会话不被归档
  })

  it('无 updatedAt 的会话跳过（闲置不参与；超限按有时间的会话排序）', () => {
    const result = selectSessionsToArchive(
      input(['s_no_time', 'a', 'b', 'c'], {
        s_no_time: {},
        a: { updatedAt: NOW - 10 * DAY },
        b: { updatedAt: NOW - 8 * DAY },
        c: { updatedAt: NOW - 6 * DAY },
      }),
      { enabled: true, idleDays: 365, maxSessions: 2 },
      NOW,
    )
    // 有时间的 3 个，上限 2 → 归档最旧 1 个；无时间的 s_no_time 不参与也不被归档
    expect(result).toEqual(['a'])
  })

  it('双条件合并去重（同一会话不重复）', () => {
    const result = selectSessionsToArchive(
      input(['s_old', 'b', 'c'], {
        s_old: { updatedAt: NOW - 40 * DAY },
        b: { updatedAt: NOW - 5 * DAY },
        c: { updatedAt: NOW - 3 * DAY },
      }),
      { enabled: true, idleDays: 30, maxSessions: 2 },
      NOW,
    )
    // 闲置 → s_old；超限（3 > 2）→ 最旧 1 个 = s_old；合并去重
    expect(result).toEqual(['s_old'])
  })

  it('输出保持输入顺序', () => {
    const result = selectSessionsToArchive(
      input(['z', 'a'], { z: { updatedAt: NOW - 100 * DAY }, a: { updatedAt: NOW - 100 * DAY } }),
      { enabled: true, idleDays: 30, maxSessions: 0 },
      NOW,
    )
    expect(result).toEqual(['z', 'a'])
  })
})
