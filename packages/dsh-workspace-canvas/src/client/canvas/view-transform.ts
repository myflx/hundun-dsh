/**
 * 画布视图变换助手（P2，参考 hundun-web WorkspaceGraph 的 view 模型）。
 *
 * 定稿模型（设计决策 D1）：节点坐标恒为 **scene 绝对像素**；`view {x, y, zoom}`
 * 是「镜头」（平移量 + 缩放），只影响渲染，不写回节点数据。
 * 本模块为纯函数，便于单测；CanvasView 只做 DOM 接入。
 */
export interface ViewTransform {
  x: number
  y: number
  zoom: number
}

export const ZOOM_MIN = 0.3
export const ZOOM_MAX = 3

/** 默认视图（identity）。 */
export function defaultView(): ViewTransform {
  return { x: 0, y: 0, zoom: 1 }
}

/** 缩放夹取到 [ZOOM_MIN, ZOOM_MAX]。 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/**
 * 以指针为锚缩放：缩放后指针所指的 scene 点保持不动。
 * @param view - 当前视图。
 * @param zoomTo - 目标缩放（内部夹取）。
 * @param pointer - 指针相对画布可视区的坐标（clientX - canvasRect.left 等）。
 * @returns 新视图（scene 锚点不变）。
 */
export function zoomAt(
  view: ViewTransform,
  zoomTo: number,
  pointer: { x: number; y: number },
): ViewTransform {
  const zoom = clampZoom(zoomTo)
  // 缩放前后 sceneX 不变：sceneX = (pointer.x - view.x) / view.zoom = (pointer.x - view'.x) / zoom
  const sceneX = (pointer.x - view.x) / view.zoom
  const sceneY = (pointer.y - view.y) / view.zoom
  return { x: pointer.x - sceneX * zoom, y: pointer.y - sceneY * zoom, zoom }
}

/** 平移视图。 */
export function panBy(view: ViewTransform, dx: number, dy: number): ViewTransform {
  return { x: view.x + dx, y: view.y + dy, zoom: view.zoom }
}

/** 重置视图（identity）。 */
export function resetView(): ViewTransform {
  return defaultView()
}

/**
 * 屏幕坐标 → scene 坐标。
 * @param view - 当前视图。
 * @param client - 指针相对画布可视区的坐标。
 * @returns scene 像素坐标。
 */
export function scenePoint(
  view: ViewTransform,
  client: { x: number; y: number },
): { x: number; y: number } {
  return { x: (client.x - view.x) / view.zoom, y: (client.y - view.y) / view.zoom }
}

/** scene 坐标 → 屏幕坐标（渲染用，或拖拽换算）。 */
export function screenPoint(
  view: ViewTransform,
  scene: { x: number; y: number },
): { x: number; y: number } {
  return { x: scene.x * view.zoom + view.x, y: scene.y * view.zoom + view.y }
}

/** 滚轮缩放因子（1.1 放大 / 0.9 缩小，hundun-web 同款）。 */
export function wheelZoomFactor(deltaY: number): number {
  return deltaY < 0 ? 1.1 : 0.9
}
