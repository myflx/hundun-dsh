/**
 * ctx.canvas 注册服务（T009）。
 *
 * 契约见 specs/001-canvas-orchestration/contracts/canvas-registry.md 与
 * packages/dsh-workspace-canvas/docs/protocol-spec.md §3：
 * - 节点类型 / 右键动作扩展 / 明细区块扩展 / 连线规则注册（重复 kind 抛错 + disposer）；
 * - 文档读写：readDocument / subscribe / mutate；
 * - mutate 校验（不变量）：节点 id 唯一、编排节点归属完整（workspaceId 指向存在的工作区）、
 *   边端点存在、边查重、未知边类型拒绝、跨工作区连线默认拒绝（crossScope 缺省 false）。
 * 校验失败 → 抛错拒绝（不静默删）。
 */
import type { ComponentType } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CanvasDocument, CanvasDocumentStore, CanvasEdge, CanvasNode } from './document.ts'

/** 订阅式快照（官方 workspaces feed 同形）。 */
export interface ObservableSnapshot<T> {
  subscribe(fn: () => void): () => void
  getSnapshot(): T
}

/** 节点业务实例（插件数据域，画布只读投影）。 */
export interface NodeInstance {
  id: string
  title?: string
  [key: string]: unknown
}

export interface NodeViewProps {
  node: CanvasNode
  instance?: NodeInstance
  selected: boolean
  dragging: boolean
  onSelect(): void
  onOpen(): void
}

export interface NodeAction {
  id: string
  label: { zh: string; en: string }
  /** 危险操作标记（右键菜单以警示色呈现，如删除）。 */
  danger?: boolean
  run(node: CanvasNode, doc: CanvasDocument): void | Promise<void>
}

export interface NodeDetailProps {
  node: CanvasNode
  instance?: NodeInstance
  doc: CanvasDocument
  close(): void
}

export interface NodeDetailSection {
  render: ComponentType<NodeDetailProps>
  label: { zh: string; en: string }
  order?: number
}

export interface NodeTypeDefinition {
  kind: string
  label: { zh: string; en: string }
  order?: number
  data: {
    list(ctx: ClientContext): ObservableSnapshot<NodeInstance[]>
    toNode?(instance: NodeInstance): Partial<Pick<CanvasNode, 'label' | 'meta' | 'workspaceId'>>
  }
  render: ComponentType<NodeViewProps>
  detail?: ComponentType<NodeDetailProps>
  actions?: NodeAction[]
  edgeKinds?: string[]
}

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left'

export interface EdgeRuleDefinition {
  kind: string
  label: { zh: string; en: string }
  order?: number
  accepts(source: CanvasNode, target: CanvasNode, doc: CanvasDocument):
    | boolean
    | { ok: true }
    | { ok: false; reason: string }
  arity?: { source?: number | 'unlimited'; target?: number | 'unlimited' }
  onConnect?(edge: CanvasEdge, doc: CanvasDocument): void | Promise<void>
  onDisconnect?(edge: CanvasEdge, doc: CanvasDocument): void | Promise<void>
  renderEdge?: ComponentType<EdgeViewProps>
  metaFields?: MetaField[]
  ports?: { sourceSides?: ConnectionSide[]; targetSides?: ConnectionSide[] }
  crossScope?: boolean
  validate?(edge: CanvasEdge, doc: CanvasDocument): string | null
}

export interface EdgeViewProps {
  edge: CanvasEdge
  source?: CanvasNode
  target?: CanvasNode
  geometry: { control1: { x: number; y: number }; control2: { x: number; y: number } }
  selected: boolean
  bend: number
}

export interface MetaField {
  key: string
  label: { zh: string; en: string }
  type: 'string' | 'number' | 'boolean' | 'select'
  options?: { value: string; label: { zh: string; en: string } }[]
  required?: boolean
  default?: unknown
}

/** ctx.canvas 公开契约（消费方视角）。 */
export interface CanvasRegistry {
  registerNodeType(def: NodeTypeDefinition): () => void
  registerNodeActions(kind: string, actions: NodeAction[], order?: number): () => void
  registerNodeDetailSection(kind: string, section: NodeDetailSection): () => void
  registerEdgeRule(def: EdgeRuleDefinition): () => void
  readDocument(): CanvasDocument
  subscribe(fn: (doc: CanvasDocument) => void): () => void
  mutate(mutator: (draft: CanvasDocument) => void): void
}

/** 画布注册表实现（含内部查询面，供视图层使用）。 */
export class CanvasRegistryImpl implements CanvasRegistry {
  private nodeTypes = new Map<string, NodeTypeDefinition>()
  private actionEntries = new Map<string, Array<{ order: number; actions: NodeAction[] }>>()
  private sectionEntries = new Map<string, Array<{ order: number; section: NodeDetailSection }>>()
  private edgeRules = new Map<string, EdgeRuleDefinition>()

  constructor(private readonly store: CanvasDocumentStore) {}

  // ── 注册 API ────────────────────────────────────────────────────────────

  registerNodeType(def: NodeTypeDefinition): () => void {
    if (this.nodeTypes.has(def.kind)) throw new Error(`节点类型重复注册：${def.kind}`)
    this.nodeTypes.set(def.kind, def)
    return () => { this.nodeTypes.delete(def.kind) }
  }

  registerNodeActions(kind: string, actions: NodeAction[], order = 0): () => void {
    const list = this.actionEntries.get(kind) ?? []
    const entry = { order, actions }
    list.push(entry)
    this.actionEntries.set(kind, list)
    return () => {
      const i = list.indexOf(entry)
      if (i >= 0) list.splice(i, 1)
    }
  }

  registerNodeDetailSection(kind: string, section: NodeDetailSection): () => void {
    const list = this.sectionEntries.get(kind) ?? []
    const entry = { order: section.order ?? 0, section }
    list.push(entry)
    this.sectionEntries.set(kind, list)
    return () => {
      const i = list.indexOf(entry)
      if (i >= 0) list.splice(i, 1)
    }
  }

  registerEdgeRule(def: EdgeRuleDefinition): () => void {
    if (this.edgeRules.has(def.kind)) throw new Error(`连线规则重复注册：${def.kind}`)
    this.edgeRules.set(def.kind, def)
    return () => { this.edgeRules.delete(def.kind) }
  }

  // ── 文档读写 ────────────────────────────────────────────────────────────

  readDocument(): CanvasDocument {
    return this.store.read()
  }

  subscribe(fn: (doc: CanvasDocument) => void): () => void {
    return this.store.subscribe(fn)
  }

  mutate(mutator: (draft: CanvasDocument) => void): void {
    // 预检：对副本应用变更并校验，非法写入抛错拒绝（不进入存储）。
    const probe = structuredClone(this.store.read())
    mutator(probe)
    validateDocument(probe, this.edgeRules)
    this.store.mutate(mutator)
  }

  // ── 内部查询面（视图层使用）─────────────────────────────────────────────

  getNodeType(kind: string): NodeTypeDefinition | undefined {
    return this.nodeTypes.get(kind)
  }

  mergeActions(kind: string): NodeAction[] {
    // 类型所有者 actions（若有）在前，扩展动作按 order 升序在后。
    const owner = this.nodeTypes.get(kind)?.actions ?? []
    const extensions = [...(this.actionEntries.get(kind) ?? [])]
      .sort((a, b) => a.order - b.order)
      .flatMap((e) => e.actions)
    return [...owner, ...extensions]
  }

  mergeSections(kind: string): NodeDetailSection[] {
    return [...(this.sectionEntries.get(kind) ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((e) => e.section)
  }

  getEdgeRule(kind: string): EdgeRuleDefinition | undefined {
    return this.edgeRules.get(kind)
  }
}

/**
 * 文档校验（不变量，protocol-spec §2.3/§2.4）。失败抛错（调用方捕获提示）。
 * @param doc - 待校验文档。
 * @param edgeRules - 已注册连线规则表（未知边类型拒绝）。
 */
export function validateDocument(doc: CanvasDocument, edgeRules: ReadonlyMap<string, EdgeRuleDefinition>): void {
  const ids = new Set<string>()
  const workspaceRefs = new Set<string>()
  for (const node of doc.nodes) {
    if (ids.has(node.id)) throw new Error(`节点 id 重复：${node.id}`)
    ids.add(node.id)
    if (node.kind === 'workspace') workspaceRefs.add(node.ref)
  }
  for (const node of doc.nodes) {
    if (node.kind === 'workspace') continue
    if (!node.workspaceId) throw new Error(`编排节点缺少归属（no-scope）：${node.id}`)
    if (!workspaceRefs.has(node.workspaceId)) {
      throw new Error(`编排节点归属指向不存在的工作区：${node.id} -> ${node.workspaceId}`)
    }
  }
  const edgeKeys = new Set<string>()
  const workspaceOf = new Map<string, string | undefined>()
  for (const node of doc.nodes) workspaceOf.set(node.id, node.workspaceId)
  for (const edge of doc.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`边端点不存在：${edge.id}`)
    const key = `${edge.kind}\u0000${edge.source}\u0000${edge.target}`
    if (edgeKeys.has(key)) throw new Error(`重复边：${edge.id}`)
    edgeKeys.add(key)
    const rule = edge.kind === 'link' ? undefined : edgeRules.get(edge.kind)
    if (edge.kind !== 'link' && rule === undefined) throw new Error(`未知边类型：${edge.kind}`)
    const crossScope = rule?.crossScope ?? false
    if (!crossScope && workspaceOf.get(edge.source) !== workspaceOf.get(edge.target)) {
      throw new Error(`跨工作区连线被拒绝（crossScope=false）：${edge.id}`)
    }
  }
}

/** 安装结果：registry 实例 + 服务注销 disposer（enabled 关闭/重开时回收再提供）。 */
export interface InstalledCanvasRegistry {
  registry: CanvasRegistryImpl
  dispose(): void
}

/** canvas 服务就绪事件（消费方插件据此注册节点类型/动作，避免 apply 时序竞态）。 */
export const CANVAS_READY_EVENT = 'canvas/ready'
/** canvas 服务卸载事件（消费方清理其注册）。 */
export const CANVAS_UNREADY_EVENT = 'canvas/unready'

/** 把注册表安装到客户端上下文（画布缺席时消费方 ctx.get('canvas') === undefined）。
 *  ctx.provide 返回 fiber-effect disposer：enabled 重挂载前必须调用，
 *  否则 Cordis 报 `service "canvas" has been registered`（同名重复提供）。
 *  提供/卸载时分别 emit canvas/ready 与 canvas/unready（消费方按服务可用性注册）。 */
export function installCanvasRegistry(ctx: ClientContext, store: CanvasDocumentStore): InstalledCanvasRegistry {
  const registry = new CanvasRegistryImpl(store)
  const dispose = ctx.provide('canvas', registry)
  ctx.emit(CANVAS_READY_EVENT, registry)
  return {
    registry,
    dispose: () => {
      dispose()
      ctx.emit(CANVAS_UNREADY_EVENT)
    },
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 编排画布注册表（dsh-workspace-canvas 提供；缺席 = undefined）。 */
    canvas?: CanvasRegistry
  }
  interface Events {
    /** canvas 服务已提供（消费方注册节点类型/动作；避免 apply 时序竞态）。 */
    'canvas/ready': (registry: CanvasRegistryImpl) => void
    /** canvas 服务已卸载（消费方清理注册）。 */
    'canvas/unready': () => void
  }
}
