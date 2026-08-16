/**
 * @hundun/dsh-panel-protocol —— 面板互斥协议共享包。
 *
 * 单一激活标记机制（设计决策 D4 / contracts/panel-protocol.md）：
 * - 页面只有一个 `data-dsh-panel-active` 属性挂在 documentElement 上，值 = 当前激活面板名；
 * - 激活 = 写标记 + 广播 `dsh-panel-activate`（CustomEvent，detail = 面板名），后写者胜；
 * - 面板只需「标记是不是我」——不需要枚举其他面板。
 *
 * 本包为纯常量/工具，无运行时身份：被各面板插件 bundle 内联（共享预设 noExternal），
 * 运行时协作完全经共享 DOM（属性 + 事件），不存在跨 bundle 状态同步问题。
 */
/** 内置面板名常量（新增面板时在此登记，供引用）。 */
export const PANELS = {
  workspaceCanvas: 'workspace-canvas',
  helloPanel: 'hello-panel',
} as const

/** 面板名（开放字符串，常量表只是内置集合）。 */
export type PanelName = string

/** 页面唯一激活标记属性名（挂在 documentElement；后写者胜）。 */
export const ACTIVE_ATTR = 'data-dsh-panel-active'

/** 面板激活事件名（CustomEvent<string>，detail = 面板名）。 */
export const ACTIVATE_EVENT = 'dsh-panel-activate'

/** 当前是否由指定面板激活（读标记；非浏览器环境恒 false）。 */
export function isActive(name: string): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.getAttribute(ACTIVE_ATTR) === name
}

/** 声明激活：写标记（后写者覆盖）+ 广播事件。 */
export function activate(name: string): void {
  document.documentElement.setAttribute(ACTIVE_ATTR, name)
  document.dispatchEvent(new CustomEvent<string>(ACTIVATE_EVENT, { detail: name }))
}

/**
 * 监听他方激活：回调仅在「激活者非自己」时触发（激活者是自己 → 忽略，避免自触发让位）。
 * @returns disposer 移除监听。
 */
export function onOtherActivate(name: string, fn: () => void): () => void {
  const handler = (event: Event): void => {
    if ((event as CustomEvent<string>).detail !== name) fn()
  }
  document.addEventListener(ACTIVATE_EVENT, handler)
  return () => document.removeEventListener(ACTIVATE_EVENT, handler)
}
