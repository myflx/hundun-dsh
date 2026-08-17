/**
 * 画布背景风格持久化（004-canvas-layout-styles）。
 *
 * 与 enabled-store 同模式：localStorage 持久化 + 同页自定义事件广播 +
 * 跨页 storage 事件。写入失败降级（仅本次会话生效，不阻断切换）。
 */
export const CANVAS_BACKGROUND_KEY = 'dsh.workspaceCanvas.background'
/** 同页广播事件（CustomEvent detail=风格 id）。 */
export const CANVAS_BACKGROUND_EVENT = 'hundun-canvas-background'

function read(): string | null {
  try {
    return localStorage.getItem(CANVAS_BACKGROUND_KEY)
  } catch {
    return null
  }
}

/** 读当前背景风格 id；null = 用户未设置过（调用方回退默认风格）。 */
export function getCanvasBackgroundId(): string | null {
  return read()
}

/** 写背景风格 id：持久化 + 同页广播。 */
export function setCanvasBackgroundId(id: string): void {
  try {
    localStorage.setItem(CANVAS_BACKGROUND_KEY, id)
  } catch {
    // 配额等写失败不阻断切换（广播仍发生，本次会话生效）
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CANVAS_BACKGROUND_EVENT, { detail: id }))
  }
}

/**
 * 订阅背景风格变化（同页自定义事件 + 跨页 storage 事件）。
 * @returns disposer。
 */
export function subscribeCanvasBackgroundId(fn: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === CANVAS_BACKGROUND_KEY) fn()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener(CANVAS_BACKGROUND_EVENT, fn)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CANVAS_BACKGROUND_EVENT, fn)
      window.removeEventListener('storage', onStorage)
    }
  }
  return () => {}
}
