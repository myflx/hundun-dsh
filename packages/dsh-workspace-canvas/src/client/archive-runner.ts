/**
 * 自动归档判断与执行（005-workspace-auto-archive）。
 *
 * selectSessionsToArchive 为纯函数：双条件 OR（闲置天数 / 未归档数超上限），
 * 跳过运行中会话、跳过无 updatedAt 的会话、幂等（已归档不重复）。
 * runAutoArchive 遍历工作区：解析配置 → 选取 → 逐个 archiveSession。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { AutoArchiveConfig } from './archive-store.ts'
import { resolveArchiveConfig, getGlobalArchiveConfig, getWorkspaceArchiveSetting } from './archive-store.ts'

/** 会话运行状态与时间查询面（sessions 服务可能缺省——安全降级为无运行中/无时间）。 */
interface SessionLookup {
  running?: boolean
  updatedAt?: number
}

/** 单个工作区的归档判定输入。 */
export interface WorkspaceArchiveInput {
  workspaceId: string
  /** 未归档会话 id 列表（feed sessionIds 中不在 archived 集合的）。 */
  unarchivedSessionIds: ReadonlyArray<string>
  /** 会话查询（byId）；缺省会话按「无 updatedAt、非运行中」处理。 */
  sessionById: Readonly<Record<string, SessionLookup | undefined>>
}

/**
 * 选取应归档的会话 id（纯函数，幂等）。
 * 规则（OR）：
 * 1. 闲置：未归档且非运行中，updatedAt 距今 > idleDays → 归档；
 * 2. 超限：未归档且非运行中的会话（有 updatedAt），按 updatedAt 升序（旧在前），
 *    超出 maxSessions（>0 时）的部分 → 归档；
 * 3. 跳过运行中会话；跳过无 updatedAt 的会话（闲置与超限均不参与）；
 * 4. 结果去重（同批不重复）。
 * @param now - 判定基准时间（测试可注入；缺省 Date.now()）。
 */
export function selectSessionsToArchive(
  input: WorkspaceArchiveInput,
  config: AutoArchiveConfig,
  now: number = Date.now(),
): string[] {
  if (!config.enabled) return []
  const idleMs = config.idleDays * 24 * 60 * 60 * 1000
  const targets = new Set<string>()

  // 可参与判断的会话：未归档、非运行中、有 updatedAt
  const eligible = input.unarchivedSessionIds
    .map((id) => ({ id, session: input.sessionById[String(id)] }))
    .filter((entry): entry is { id: string; session: SessionLookup } =>
      entry.session !== undefined && entry.session.running !== true && typeof entry.session.updatedAt === 'number')

  // 条件 1：闲置超期
  for (const { id, session } of eligible) {
    const age = now - (session.updatedAt as number)
    if (age > idleMs) targets.add(id)
  }

  // 条件 2：未归档数超上限（取有时间的会话按旧→新，归档差额）
  if (config.maxSessions > 0 && eligible.length > config.maxSessions) {
    const excess = eligible.length - config.maxSessions
    const byOldest = [...eligible].sort((a, b) => (a.session.updatedAt as number) - (b.session.updatedAt as number))
    for (let i = 0; i < excess && i < byOldest.length; i += 1) {
      targets.add(byOldest[i].id)
    }
  }

  // 保持输入顺序（稳定输出，便于测试）
  return input.unarchivedSessionIds.filter((id) => targets.has(String(id)))
}

/** 收集一个工作区的归档判定输入（feed 未归档集合 × sessions 查询）。 */
export function workspaceArchiveInput(
  sessionIds: ReadonlyArray<string>,
  archivedSessionIds: ReadonlySet<string>,
  sessionById: Readonly<Record<string, SessionLookup | undefined>>,
): WorkspaceArchiveInput {
  return {
    workspaceId: 'input',
    unarchivedSessionIds: sessionIds.filter((id) => !archivedSessionIds.has(String(id))),
    sessionById,
  }
}

/**
 * 对全部工作区执行一次自动归档。
 * 仅归档启用了自动归档的工作区（解析自定义 > 全局默认）；单个会话失败不阻断其余
 * （每工作区最多提示一次）。返回成功归档数。
 */
export async function runAutoArchive(
  ctx: ClientContext,
  workspaces: ReadonlyArray<{ workspaceId: string; sessionIds: ReadonlyArray<string> }>,
  archivedSessionIds: ReadonlySet<string>,
  onNotify?: (message: string) => void,
): Promise<number> {
  const globalConfig = getGlobalArchiveConfig()
  // sessions 查询面（Proxy 注入保护：try/catch 兜底，缺省按无 updatedAt 处理）
  let sessionById: Record<string, SessionLookup | undefined> = {}
  try {
    const byId = (ctx as { sessions?: { list?: { getSnapshot?: () => { byId?: Record<string, SessionLookup> } } } } | undefined)
      ?.sessions?.list?.getSnapshot?.().byId
    if (byId !== undefined) sessionById = byId
  } catch {
    sessionById = {}
  }

  let archived = 0
  for (const workspace of workspaces) {
    const setting = getWorkspaceArchiveSetting(String(workspace.workspaceId))
    const config = resolveArchiveConfig(globalConfig, setting)
    if (!config.enabled) continue
    const input = workspaceArchiveInput(workspace.sessionIds, archivedSessionIds, sessionById)
    const targets = selectSessionsToArchive(input, config)
    if (targets.length === 0) continue
    for (const sessionId of targets) {
      try {
        await (ctx.workspaces as { archiveSession?: (id: unknown) => Promise<unknown> }).archiveSession?.(sessionId)
        archived += 1
      } catch (err) {
        onNotify?.(err instanceof Error ? `自动归档会话失败：${err.message}` : '自动归档会话失败')
        break // 该工作区后续会话失败已提示，不再重复刷屏
      }
    }
  }
  return archived
}
