/**
 * 画布 enabled 总开关（客户端本地持久化）。
 *
 * 平台限制（T033 修正）：官方 dsh-host-apiproxy 的配置客户端白名单是硬编码
 * （WEB_SETTINGS_NAMESPACES / PRODUCT_SETTINGS_NAMESPACES + 模型提供方），
 * 第三方插件的 settings 命名空间无法暴露给浏览器设置客户端（官方注释：
 * "a plugin can expose its own configuration without a change in this package
 * is deferred work"）。因此画布开关改为：localStorage 持久化 + 同页自定义事件
 * 广播 + 跨页 storage 事件；宿主公告仍由组合配置（profile 配置）控制。
 */
export const CANVAS_ENABLED_KEY = 'dsh.workspaceCanvas.enabled'
/** 同页广播事件（CustomEvent detail=boolean）。 */
export const CANVAS_ENABLED_EVENT = 'hundun-canvas-enabled'

function read(): boolean | null {
  try {
    const raw = localStorage.getItem(CANVAS_ENABLED_KEY)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

/** 读当前 enabled：null = 用户未设置过（调用方以组合配置兜底）。 */
export function getCanvasEnabled(): boolean | null {
  return read()
}

/** 写 enabled：持久化 + 同页广播。 */
export function setCanvasEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CANVAS_ENABLED_KEY, String(enabled))
  } catch {
    // 配额等写失败不阻断运行时联动（广播仍发生）
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CANVAS_ENABLED_EVENT, { detail: enabled }))
  }
}

/**
 * 订阅 enabled 变化（同页自定义事件 + 跨页 storage 事件）。
 * @returns disposer。
 */
export function subscribeCanvasEnabled(fn: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === CANVAS_ENABLED_KEY) fn()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener(CANVAS_ENABLED_EVENT, fn)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CANVAS_ENABLED_EVENT, fn)
      window.removeEventListener('storage', onStorage)
    }
  }
  return () => {}
}
