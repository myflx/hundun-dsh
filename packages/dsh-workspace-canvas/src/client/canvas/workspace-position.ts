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

/** 卡片物理尺寸（与 CanvasView.CARD_STYLE 同源）：水平/垂直相邻卡片不重叠的最小间距。 */
export const CARD_WIDTH = 200
export const CARD_HEIGHT = 80

/**
 * 完全重叠阈值：两张卡片重叠面积达到 80% 即需要避让。
 * 拖动过程允许重叠，松开时才以 12px 夹角微移避让，避免大幅跳动。
 */
export const FULL_OVERLAP_RATIO = 0.8
export const OVERLAP_NUDGE = 12

/** 两张卡片的重叠面积占比（0~1；不重叠为 0）。 */
export function overlapRatio(a: CanvasPosition, b: CanvasPosition): number {
  const overlapW = Math.max(0, CARD_WIDTH - Math.abs(a.x - b.x))
  const overlapH = Math.max(0, CARD_HEIGHT - Math.abs(a.y - b.y))
  return (overlapW * overlapH) / (CARD_WIDTH * CARD_HEIGHT)
}

/**
 * 判定两个工作区位置是否达到「完全重叠」阈值。
 * 面积重叠达到 80% 才需要避让，低于阈值的部分重叠保持原位。
 */
export function positionsFullyOverlap(a: CanvasPosition, b: CanvasPosition): boolean {
  return overlapRatio(a, b) >= FULL_OVERLAP_RATIO
}

/**
 * 微移避让：目标位置若与其他工作区完全同点，按 12px 螺旋找最近的不重合位置。
 * 不再使用画布 GRID 步进，避免松开鼠标时出现大幅跳动。
 * - 目标与所有占用均非完全重叠 → 原样返回；
 * - 完全重叠 → 从目标点出发按 12px 半径逐圈扫描，返回第一个不重合的位置。
 * @param target - 期望落位（scene 坐标）。
 * @param occupied - 其他工作区的已占用位置（不含自身）。
 * @returns 非完全重叠的落位（尽量靠近目标）。
 */
export function avoidOverlap(
  target: CanvasPosition,
  occupied: ReadonlyArray<CanvasPosition>,
): CanvasPosition {
  if (!occupied.some((o) => positionsFullyOverlap(target, o))) return target
  // 从半径 1 起逐圈扫描；拖动只在 pointerup 调用，微移不会造成过程中的跳动。
  for (let radius = 1; radius <= 32; radius += 1) {
    const distance = radius * OVERLAP_NUDGE
    // 固定优先向右下角微移，避免避让方向在上下左右之间来回变化。
    const diagonal = [
      { x: target.x + distance, y: target.y + distance },
      { x: target.x + distance, y: target.y - distance },
      { x: target.x - distance, y: target.y + distance },
      { x: target.x - distance, y: target.y - distance },
    ]
    const freeDiagonal = diagonal.find((candidate) => !occupied.some((o) => positionsFullyOverlap(candidate, o)))
    if (freeDiagonal !== undefined) return freeDiagonal

    const cardinal = [
      { x: target.x + distance, y: target.y },
      { x: target.x - distance, y: target.y },
      { x: target.x, y: target.y + distance },
      { x: target.x, y: target.y - distance },
    ]
    const freeCardinal = cardinal.find((candidate) => !occupied.some((o) => positionsFullyOverlap(candidate, o)))
    if (freeCardinal !== undefined) return freeCardinal

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx === 0 || dy === 0) continue // 上下左右已优先检查
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue // 只扫当前圈
        const candidate = {
          x: target.x + dx * distance,
          y: target.y + dy * distance,
        }
        if (!occupied.some((o) => positionsFullyOverlap(candidate, o))) return candidate
      }
    }
  }
  // 兜底（32 圈内全占满——极不现实）：直接偏移一大步。
  return { x: target.x + OVERLAP_NUDGE * 33, y: target.y }
}

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
