/**
 * CanvasDocument v1 文档模型与存储（T008）。
 *
 * 权威语义见 specs/001-canvas-orchestration/data-model.md 与
 * packages/dsh-workspace-canvas/docs/protocol-spec.md §2：
 * - 纯 JSON 文档（引用 + 布局 + 关系，不含业务数据），存 localStorage；
 * - 500ms 防抖写；损坏 → 备份原串到 .bak + 以空文档启动（recovered=true）；
 * - 配额满 / 写失败 → 只读降级 + 一次性提示（quotaExceeded 标志），内存文档不丢；
 * - migrate() 迁移链（v1 无旧版本，透传预留）。
 */
export interface CanvasViewState {
  x: number
  y: number
  zoom: number
}

export interface CanvasPosition {
  x: number
  y: number
}

export interface CanvasNode {
  id: string
  kind: string
  ref: string
  /** 归属（仅编排节点必填）：所属工作区的业务 id（与 workspace 节点 ref 同值）。 */
  workspaceId?: string
  label?: string
  position: CanvasPosition
  /** 插件自由扩展；`meta.invalid` 为画布保留。 */
  meta?: Record<string, unknown>
}

export interface CanvasEdge {
  id: string
  kind: string
  source: string
  target: string
  meta?: Record<string, unknown>
}

export interface CanvasDocument {
  version: 1
  view?: CanvasViewState
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export const DOC_STORAGE_KEY = 'dsh.workspaceCanvas.doc.v1'
export const DOC_BAK_KEY = 'dsh.workspaceCanvas.doc.v1.bak'

export function createEmptyDocument(): CanvasDocument {
  return { version: 1, nodes: [], edges: [] }
}

/** 删除节点并连带删除其全部边（T020；一次 mutate，保证一致性）。 */
export function removeNodeCascade(store: CanvasDocumentStore, nodeId: string): void {
  store.mutate((doc) => {
    doc.nodes = doc.nodes.filter((n) => n.id !== nodeId)
    doc.edges = doc.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
  })
}

/** 文档迁移链：版本 < 1 或未来版本在此处理；v1 透传（预留）。 */
export function migrate(doc: CanvasDocument): CanvasDocument {
  return doc
}

/** 读原始存储并解析；损坏时备份原串并报告 recovered。 */
function loadRaw(storage: Storage): { doc: CanvasDocument; recovered: boolean } {
  try {
    const raw = storage.getItem(DOC_STORAGE_KEY)
    if (raw === null) return { doc: createEmptyDocument(), recovered: false }
    const parsed = JSON.parse(raw) as CanvasDocument
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== 1) {
      throw new Error('unsupported document version')
    }
    return { doc: parsed, recovered: false }
  } catch {
    // 损坏 / 版本不支持：备份原串后以空文档启动（不静默丢数据）。
    try {
      const raw = storage.getItem(DOC_STORAGE_KEY)
      if (raw !== null) storage.setItem(DOC_BAK_KEY, raw)
    } catch {
      // 备份失败不阻断启动
    }
    return { doc: createEmptyDocument(), recovered: true }
  }
}

/**
 * 画布文档存储：内存文档单一事实源 + 防抖持久化 + 降级。
 * @param storage - 存储后端（默认 localStorage，测试可注入 mock）。
 * @param debounceMs - 防抖窗口（默认 500ms）。
 */
export class CanvasDocumentStore {
  private doc: CanvasDocument
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<(doc: CanvasDocument) => void>()

  /** 本次加载是否发生过损坏恢复（true 时 UI 应提示）。 */
  readonly recovered: boolean
  /** 是否触发过配额/写失败降级（一次性提示标志）。 */
  quotaExceeded = false

  constructor(
    private readonly storage: Storage = localStorage,
    private readonly debounceMs = 500,
  ) {
    const loaded = loadRaw(storage)
    this.doc = loaded.recovered ? loaded.doc : migrate(loaded.doc)
    this.recovered = loaded.recovered
  }

  /** 读当前文档（只读快照；内容变化时引用更新）。 */
  read(): CanvasDocument {
    return this.doc
  }

  /** 订阅文档变化（每次 mutate 成功后触发）。 */
  subscribe(fn: (doc: CanvasDocument) => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** 合并式写入：应用变更 → 防抖持久化 → 广播。 */
  mutate(fn: (draft: CanvasDocument) => void): void {
    const draft = structuredClone(this.doc)
    fn(draft)
    this.doc = draft
    this.scheduleSave()
    for (const listener of [...this.listeners]) listener(this.doc)
  }

  /** 立即落盘（供测试与显式刷新使用；仍走配额降级）。 */
  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.persist()
  }

  /** 卸载：取消挂起的防抖写（已调度的持久化不再执行）。 */
  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.listeners.clear()
  }

  private scheduleSave(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.persist()
    }, this.debounceMs)
  }

  private persist(): void {
    try {
      this.storage.setItem(DOC_STORAGE_KEY, JSON.stringify(this.doc))
    } catch {
      // 配额满 / 写失败：只读降级 + 一次性提示；内存文档不丢（下次成功写覆盖）。
      this.quotaExceeded = true
    }
  }
}
