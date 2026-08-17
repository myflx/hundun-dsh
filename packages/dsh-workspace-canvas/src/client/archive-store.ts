/**
 * 归档配置持久化（005-workspace-auto-archive）。
 *
 * 与 enabled-store / background-store 同模式：localStorage + 同页自定义事件广播 +
 * 跨页 storage 事件。两类配置：
 * - 全局默认（AutoArchiveConfig）：设置页「归档」分组读写；
 * - 工作区自定义（WorkspaceArchiveSetting）：详情框归档区读写，按 workspaceId 键存。
 * 解析优先级：工作区自定义 > 全局默认 > 内置默认（关闭 / 30 天 / 不限会话数）。
 */
export const ARCHIVE_CONFIG_KEY = 'dsh.workspaceCanvas.archive'
export const ARCHIVE_WORKSPACES_KEY = 'dsh.workspaceCanvas.archive.workspaces'
/** 同页广播事件。 */
export const CANVAS_ARCHIVE_EVENT = 'hundun-canvas-archive'

/** 归档配置：启用 + 双条件阈值（闲置天数 / 未归档会话数上限）。 */
export interface AutoArchiveConfig {
  enabled: boolean
  /** 闲置天数（updatedAt 距今超过即归档）。 */
  idleDays: number
  /** 未归档会话数上限；0 = 不限制。 */
  maxSessions: number
}

/** 内置默认（全局未设置时）。默认关闭（安全，不静默改动用户会话）。 */
export const ARCHIVE_DEFAULT: AutoArchiveConfig = { enabled: false, idleDays: 30, maxSessions: 0 }

/** 工作区归档设置：跟随默认 或 自定义（覆盖字段缺省时继承全局默认）。 */
export interface WorkspaceArchiveSetting {
  mode: 'default' | 'custom'
  enabled?: boolean
  idleDays?: number
  maxSessions?: number
}

function sanitize(config: Partial<AutoArchiveConfig> | null | undefined): AutoArchiveConfig {
  const base = { ...ARCHIVE_DEFAULT }
  if (config === null || typeof config !== 'object') return base
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : base.enabled,
    idleDays: typeof config.idleDays === 'number' && config.idleDays > 0 ? config.idleDays : base.idleDays,
    maxSessions: typeof config.maxSessions === 'number' && config.maxSessions >= 0 ? config.maxSessions : base.maxSessions,
  }
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 读全局默认归档配置（未设置或损坏 → 内置默认）。 */
export function getGlobalArchiveConfig(): AutoArchiveConfig {
  return sanitize(readJSON<Partial<AutoArchiveConfig>>(ARCHIVE_CONFIG_KEY))
}

/** 写全局默认归档配置：持久化 + 广播。 */
export function setGlobalArchiveConfig(config: AutoArchiveConfig): void {
  writeJSON(ARCHIVE_CONFIG_KEY, sanitize(config))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CANVAS_ARCHIVE_EVENT))
  }
}

/** 读某工作区的归档设置；未设置 → undefined（跟随默认）。 */
export function getWorkspaceArchiveSetting(workspaceId: string): WorkspaceArchiveSetting | undefined {
  const map = readJSON<Record<string, WorkspaceArchiveSetting>>(ARCHIVE_WORKSPACES_KEY)
  const setting = map?.[workspaceId]
  if (setting === undefined) return undefined
  // 损坏/非法 → 视为未设置
  if (typeof setting !== 'object' || setting.mode !== 'custom') return undefined
  return setting
}

/** 写某工作区归档设置（mode='default' 表示清除自定义）；广播。 */
export function setWorkspaceArchiveSetting(workspaceId: string, setting: WorkspaceArchiveSetting): void {
  const map = readJSON<Record<string, WorkspaceArchiveSetting>>(ARCHIVE_WORKSPACES_KEY) ?? {}
  if (setting.mode === 'default') {
    delete map[workspaceId]
  } else {
    map[workspaceId] = {
      mode: 'custom',
      enabled: typeof setting.enabled === 'boolean' ? setting.enabled : undefined,
      idleDays: typeof setting.idleDays === 'number' && setting.idleDays > 0 ? setting.idleDays : undefined,
      maxSessions: typeof setting.maxSessions === 'number' && setting.maxSessions >= 0 ? setting.maxSessions : undefined,
    }
  }
  if (Object.keys(map).length === 0) {
    try { localStorage.removeItem(ARCHIVE_WORKSPACES_KEY) } catch { /* ignore */ }
  } else {
    writeJSON(ARCHIVE_WORKSPACES_KEY, map)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CANVAS_ARCHIVE_EVENT))
  }
}

/** 解析某工作区生效的归档配置：自定义 > 全局默认 > 内置默认。 */
export function resolveArchiveConfig(
  globalConfig: AutoArchiveConfig,
  workspaceSetting: WorkspaceArchiveSetting | undefined,
): AutoArchiveConfig {
  const global = sanitize(globalConfig)
  if (workspaceSetting === undefined || workspaceSetting.mode !== 'custom') return global
  return sanitize({
    enabled: workspaceSetting.enabled ?? global.enabled,
    idleDays: workspaceSetting.idleDays ?? global.idleDays,
    maxSessions: workspaceSetting.maxSessions ?? global.maxSessions,
  })
}

/**
 * 订阅归档配置变化（同页自定义事件 + 跨页 storage 事件；覆盖全局与工作区两类键）。
 * @returns disposer。
 */
export function subscribeArchiveConfig(fn: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === ARCHIVE_CONFIG_KEY || event.key === ARCHIVE_WORKSPACES_KEY) fn()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener(CANVAS_ARCHIVE_EVENT, fn)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CANVAS_ARCHIVE_EVENT, fn)
      window.removeEventListener('storage', onStorage)
    }
  }
  return () => {}
}
