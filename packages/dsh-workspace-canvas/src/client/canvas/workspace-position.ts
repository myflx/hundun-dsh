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
