/**
 * 归档配置持久化与优先级契约测试（005-workspace-auto-archive）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  ARCHIVE_DEFAULT,
  clearOptimisticArchived,
  getGlobalArchiveConfig,
  getOptimisticArchived,
  getWorkspaceArchiveSetting,
  markArchivedOptimistic,
  resolveArchiveConfig,
  setGlobalArchiveConfig,
  setWorkspaceArchiveSetting,
  subscribeOptimisticArchived,
} from '../src/client/archive-store.ts'

afterEach(() => {
  localStorage.clear()
  clearOptimisticArchived()
})

describe('归档配置持久化（005）', () => {
  it('未设置 → 内置默认（关闭 / 30 天 / 不限会话数）', () => {
    expect(getGlobalArchiveConfig()).toEqual(ARCHIVE_DEFAULT)
  })

  it('设置全局默认 → 持久化 + 可读回', () => {
    setGlobalArchiveConfig({ enabled: true, idleDays: 7, maxSessions: 50 })
    expect(getGlobalArchiveConfig()).toEqual({ enabled: true, idleDays: 7, maxSessions: 50 })
  })

  it('非法阈值（0 天 / 负数上限）被消毒回默认', () => {
    setGlobalArchiveConfig({ enabled: true, idleDays: 0, maxSessions: -1 })
    const config = getGlobalArchiveConfig()
    expect(config.idleDays).toBe(30)
    expect(config.maxSessions).toBe(0)
    expect(config.enabled).toBe(true)
  })

  it('损坏 JSON → 回退内置默认', () => {
    localStorage.setItem('dsh.workspaceCanvas.archive', '{broken')
    expect(getGlobalArchiveConfig()).toEqual(ARCHIVE_DEFAULT)
  })

  it('工作区自定义读写；mode=default 清除自定义', () => {
    expect(getWorkspaceArchiveSetting('ws_1')).toBeUndefined()
    setWorkspaceArchiveSetting('ws_1', { mode: 'custom', enabled: true, idleDays: 3, maxSessions: 10 })
    expect(getWorkspaceArchiveSetting('ws_1')).toEqual({ mode: 'custom', enabled: true, idleDays: 3, maxSessions: 10 })
    // 其他工作区不受影响
    expect(getWorkspaceArchiveSetting('ws_2')).toBeUndefined()
    setWorkspaceArchiveSetting('ws_1', { mode: 'default' })
    expect(getWorkspaceArchiveSetting('ws_1')).toBeUndefined()
  })

  it('解析优先级：自定义 > 全局 > 内置默认', () => {
    const global = { enabled: true, idleDays: 30, maxSessions: 0 }
    // 无自定义 → 全局
    expect(resolveArchiveConfig(global, undefined)).toEqual(global)
    // 自定义覆盖部分字段 → 未覆盖继承全局
    expect(resolveArchiveConfig(global, { mode: 'custom', enabled: false }))
      .toEqual({ enabled: false, idleDays: 30, maxSessions: 0 })
    // 自定义损坏（非 custom）→ 全局
    expect(resolveArchiveConfig(global, { mode: 'bogus' } as never)).toEqual(global)
  })

  it('乐观归档标记：mark → 集合包含 + 订阅通知；clear 清空', () => {
    const calls: string[] = []
    const unsub = subscribeOptimisticArchived(() => calls.push('changed'))
    markArchivedOptimistic('ss_1')
    markArchivedOptimistic('ss_2')
    expect([...getOptimisticArchived()]).toEqual(['ss_1', 'ss_2'])
    expect(calls.length).toBe(2)
    // 重复标记幂等
    markArchivedOptimistic('ss_1')
    expect(calls.length).toBe(3)
    expect(getOptimisticArchived().size).toBe(2)
    clearOptimisticArchived()
    expect(getOptimisticArchived().size).toBe(0)
    expect(calls.length).toBe(4)
    unsub()
  })
})
