/**
 * 工作区节点投影同步（T018）。
 *
 * 画布文档中的 workspace 节点 = 官方 feed 的投影 + 位置存档：
 * - feed 中新增的工作区 → 自动补建节点（保留已存档位置，否则按 feed 顺序 GRID
 *   落位——修复：补建不再写死 (0,0)，否则多个新工作区全部堆在原点上重叠）；
 * - feed 中消失的工作区 → 级联删除其成员节点（workspaceId 匹配）与相关边，
 *   返回消失列表供调用方提示。
 * 实例数据（标题/路径/会话数）实时读 feed，画布不缓存。
 */
import type { CanvasDocumentStore } from './document.ts'
import { AUTO_LAYOUT_COLS, AUTO_LAYOUT_STEP_X, AUTO_LAYOUT_STEP_Y, AUTO_LAYOUT_ORIGIN } from './workspace-position.ts'

/**
 * 删除工作区及其全部成员（T024）：级联移除成员节点与相关边 + 工作区节点本身。
 * @returns 被级联删除的成员节点数（供确认提示）。
 */
export function removeWorkspaceCascade(store: CanvasDocumentStore, workspaceId: string): number {
  let removedMembers = 0
  store.mutate((doc) => {
    const memberIds = new Set(
      doc.nodes
        .filter((n) => n.kind !== 'workspace' && n.workspaceId === workspaceId)
        .map((n) => n.id),
    )
    removedMembers = memberIds.size
    doc.nodes = doc.nodes.filter(
      (n) => !memberIds.has(n.id) && !(n.kind === 'workspace' && n.ref === workspaceId),
    )
    doc.edges = doc.edges.filter((e) => !memberIds.has(e.source) && !memberIds.has(e.target))
  })
  return removedMembers
}

/** 按 feed 对账文档中的工作区节点；返回本次消失的工作区 id 列表。 */
export function syncWorkspaceNodes(
  store: CanvasDocumentStore,
  workspaces: ReadonlyArray<{ workspaceId: string }>,
): string[] {
  const feedIds = new Set(workspaces.map((w) => w.workspaceId))
  let removed: string[] = []
  store.mutate((doc) => {
    // 1) 保留仍在 feed 的节点；收集消失的工作区 ref。
    const removedRefs = new Set<string>()
    const kept: typeof doc.nodes = []
    for (const node of doc.nodes) {
      if (node.kind === 'workspace') {
        if (feedIds.has(node.ref)) kept.push(node)
        else removedRefs.add(node.ref)
      } else {
        kept.push(node)
      }
    }
    // 2) 级联：消失工作区的成员节点（workspaceId ∈ removedRefs）与其边一并删除。
    const memberIds = new Set(
      kept
        .filter((n) => n.kind !== 'workspace' && n.workspaceId !== undefined && removedRefs.has(n.workspaceId))
        .map((n) => n.id),
    )
    doc.nodes = kept.filter((n) => !memberIds.has(n.id))
    doc.edges = doc.edges.filter((e) => !memberIds.has(e.source) && !memberIds.has(e.target))
    // 3) 补建 feed 中缺失的工作区节点（保留位置存档 → 由 kept 中的节点承载；
    //    新建的按 feed 顺序 GRID 落位——修复：不再写死 (0,0)，避免多工作区全部
    //    堆在原点上重叠（与 autoLayoutWorkspaces / CanvasView.autoPosition 同参数）。
    const existingRefs = new Set(doc.nodes.filter((n) => n.kind === 'workspace').map((n) => n.ref))
    for (const [index, w] of workspaces.entries()) {
      if (existingRefs.has(w.workspaceId)) continue
      doc.nodes.push({
        id: `ws:${w.workspaceId}`,
        kind: 'workspace',
        ref: w.workspaceId,
        position: {
          x: (index % AUTO_LAYOUT_COLS) * AUTO_LAYOUT_STEP_X + AUTO_LAYOUT_ORIGIN,
          y: Math.floor(index / AUTO_LAYOUT_COLS) * AUTO_LAYOUT_STEP_Y + AUTO_LAYOUT_ORIGIN,
        },
      })
    }
    removed = [...removedRefs]
  })
  return removed
}
