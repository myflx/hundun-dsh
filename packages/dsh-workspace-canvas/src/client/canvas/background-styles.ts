/**
 * 画布背景风格注册表（004-canvas-layout-styles）。
 *
 * 单一注册机制：新增风格只需在 CANVAS_BACKGROUND_STYLES 追加一项，设置页与
 * 操作栏切换控件自动列出。背景层与节点层解耦：切换背景不重置拖拽/缩放/选中。
 * 图案类（网格/点阵/暗色网格/蓝图）平移取模跟随；铺满类（纯色/渐变）固定。
 */
export interface CanvasBackgroundStyle {
  /** 唯一标识（持久化存此值）。 */
  id: string
  /** 用户可见名称。 */
  name: string
  /** 一句说明（设置页/切换面板展示）。 */
  description: string
  /** CSS background-image（无图案为 'none'）。 */
  backgroundImage: string
  /** background-size（图案格距；铺满类省略）。 */
  backgroundSize?: string
  /** 底色。 */
  backgroundColor: string
  /** 平移是否取模跟随（图案类 true；铺满类 false）。 */
  followPan: boolean
}

/** 默认背景风格 id（现状网格，向后兼容）。 */
export const DEFAULT_BACKGROUND_ID = 'grid'

/** 全部注册的背景风格（顺序即设置页展示顺序）。 */
export const CANVAS_BACKGROUND_STYLES: readonly CanvasBackgroundStyle[] = [
  {
    id: 'grid',
    name: '网格',
    description: '无限网格底，随平移跟随',
    backgroundImage: [
      'linear-gradient(var(--dsw-alias-border-l2) 1px, transparent 1px)',
      'linear-gradient(90deg, var(--dsw-alias-border-l2) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '24px 24px',
    backgroundColor: 'transparent',
    followPan: true,
  },
  {
    id: 'dots',
    name: '点阵',
    description: '圆点矩阵底，随平移跟随',
    backgroundImage: 'radial-gradient(circle, var(--dsw-alias-border-l2) 1.2px, transparent 1.2px)',
    backgroundSize: '24px 24px',
    backgroundColor: 'transparent',
    followPan: true,
  },
  {
    id: 'solid',
    name: '纯色',
    description: '无图案纯背景',
    backgroundImage: 'none',
    backgroundColor: 'var(--dsw-alias-bg-layer-1)',
    followPan: false,
  },
  {
    id: 'gradient',
    name: '渐变',
    description: '柔和渐变背景',
    backgroundImage: 'linear-gradient(160deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2))',
    backgroundColor: 'var(--dsw-alias-bg-layer-1)',
    followPan: false,
  },
  {
    id: 'dark-grid',
    name: '暗色网格',
    description: '弱化网格线，暗色下更隐形的网格底',
    backgroundImage: [
      'linear-gradient(color-mix(in srgb, var(--dsw-alias-border-l2) 45%, transparent) 1px, transparent 1px)',
      'linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-border-l2) 45%, transparent) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '24px 24px',
    backgroundColor: 'transparent',
    followPan: true,
  },
]

/** 按 id 解析背景风格；未知/损坏值回退默认「网格」（不崩）。 */
export function getCanvasBackgroundStyle(id: string | null | undefined): CanvasBackgroundStyle {
  return CANVAS_BACKGROUND_STYLES.find((style) => style.id === id) ?? CANVAS_BACKGROUND_STYLES[0]
}
