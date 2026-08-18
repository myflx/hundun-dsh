/**
 * 浏览器半区文案：zh 为键集来源，en 镜像每个键（全家桶惯例）。
 */

/** 简体中文词典（键集的事实来源）。 */
export const zh = {
  'canvas.title': '工作区画布',
  'canvas.subtitle': '双击卡片进入对应工作区的新会话',
  'canvas.empty': '还没有工作区。先在侧边栏添加一个工作区，画布会自动渲染。',
  'canvas.loading': '正在加载工作区…',
  'canvas.sessions': '{n} 个会话',
  'canvas.close': '关闭画布',
  'canvas.button': '画布视图',
  'canvas.buttonTooltip': '打开工作区画布视图',
  'canvas.openHint': '画布已打开',
  'canvas.openError': '进入会话失败：{message}',
  'canvas.settings': '工作区',
} satisfies Record<string, string>

/** 键集并集。 */
export type CanvasKey = keyof typeof zh

/** 英文词典，键集与 zh 完全一致。 */
export const en = {
  'canvas.title': 'Workspace canvas',
  'canvas.subtitle': 'Click a card to start a new session in that workspace',
  'canvas.empty': 'No workspaces yet. Add one in the sidebar and the canvas renders it automatically.',
  'canvas.loading': 'Loading workspaces…',
  'canvas.sessions': '{n} sessions',
  'canvas.close': 'Close canvas',
  'canvas.button': 'Canvas',
  'canvas.buttonTooltip': 'Open workspace canvas view',
  'canvas.openHint': 'Canvas is open',
  'canvas.openError': 'Failed to open session: {message}',
  'canvas.settings': 'Canvas',
} satisfies Record<CanvasKey, string>

/** 微型插值：{name} -> value（参照 既有面板 的 t 实现）。 */
export function t(dictionary: Record<string, string>, key: string, values?: Record<string, string | number>): string {
  let text = dictionary[key] ?? key
  if (values !== undefined) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** 按文档语言选字典。 */
export function dictionary(): Record<string, string> {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  return lang.toLowerCase().startsWith('en') ? { ...en } : { ...zh }
}
