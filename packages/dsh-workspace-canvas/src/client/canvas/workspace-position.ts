/**
 * 工作区布局持久化助手（T015/T016）。
 *
 * 工作区节点约定：id = `ws:${workspaceId}`（确定性），ref = 工作区 id，kind = 'workspace'。
 * 画布只存档「位置 + ref」，实例数据实时读官方 feed（T018 同步）。
 */
import type { CanvasDocumentStore, CanvasPosition } from './document.ts'

/** 写入/更新某工作区节点的位置（不存在则创建占位节点）。 */
export function commitWorkspacePosition(
  store: CanvasDocumentStore,
  workspaceId: string,
  position: CanvasPosition,
): void {
  store.mutate((doc) => {
    const existing = doc.nodes.find((n) => n.kind === 'workspace' && n.ref === workspaceId)
    if (existing !== undefined) {
      existing.position = position
      return
    }
    doc.nodes.push({
      id: `ws:${workspaceId}`,
      kind: 'workspace',
      ref: workspaceId,
      position,
    })
  })
}

/** 读文档中已存档的工作区位置（workspaceId → position）。 */
export function readWorkspacePositions(store: CanvasDocumentStore): Record<string, CanvasPosition> {
  const out: Record<string, CanvasPosition> = {}
  for (const node of store.read().nodes) {
    if (node.kind === 'workspace') out[node.ref] = node.position
  }
  return out
}

/** GRID 自动布局步进（与 CanvasView 初始布局同参数：每行 4 列、步进 216×112、起点 +12）。 */
export const AUTO_LAYOUT_COLS = 4
export const AUTO_LAYOUT_STEP_X = 216
export const AUTO_LAYOUT_STEP_Y = 112
export const AUTO_LAYOUT_ORIGIN = 12

/** 自动布局：按传入顺序（通常为 feed 顺序）把每个工作区重排到 GRID 格位（消除重叠、对齐网格）。
 *  空数组 = 空操作（不 mutate）。成员节点存工作区局部坐标，随工作区移动自动保留相对位置。 */
export function autoLayoutWorkspaces(
  store: CanvasDocumentStore,
  workspaceIds: ReadonlyArray<string>,
): void {
  if (workspaceIds.length === 0) return
  store.mutate((doc) => {
    for (const [index, workspaceId] of workspaceIds.entries()) {
      const position = autoPosition(index)
      const existing = doc.nodes.find((n) => n.kind === 'workspace' && n.ref === workspaceId)
      if (existing !== undefined) {
        existing.position = position
      } else {
        doc.nodes.push({ id: `ws:${workspaceId}`, kind: 'workspace', ref: workspaceId, position })
      }
    }
  })
}

/** GRID 自动布局坐标（与 CanvasView 初始布局一致，保证对齐网格线）。 */
function autoPosition(index: number): CanvasPosition {
  return {
    x: (index % AUTO_LAYOUT_COLS) * AUTO_LAYOUT_STEP_X + AUTO_LAYOUT_ORIGIN,
    y: Math.floor(index / AUTO_LAYOUT_COLS) * AUTO_LAYOUT_STEP_Y + AUTO_LAYOUT_ORIGIN,
  }
}
