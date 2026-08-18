/**
 * 右侧明细面板框架（T026）。
 *
 * 组合渲染：类型所有者 detail（若有）+ 扩展区块（registerNodeDetailSection，
 * 按 order 排序，由调用方合并）。面板在画布视图内部右侧固定列；
 * **宽度有限调节**：左侧边缘拖拽手柄可调整宽度（默认 420，范围 240–560）。
 */
import { createElement, useRef, useState } from 'react'
import type { ComponentType, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasDocument, CanvasNode } from '../document.ts'
import type { NodeDetailProps, NodeDetailSection, NodeInstance } from '../registry.ts'

export interface DetailPanelProps {
  node: CanvasNode
  instance?: NodeInstance
  doc: CanvasDocument
  /** 类型所有者明细视图（可选）。 */
  ownerDetail?: ComponentType<NodeDetailProps>
  /** 扩展区块（已按 order 合并）。 */
  sections: NodeDetailSection[]
  /** 显示标题（可选）：调用方显式提供的标题优先（如工作区未命名时用路径文件夹名）。 */
  title?: string
  onClose(): void
}

/** 详情框宽度范围（有限调节）。默认加宽：工作区 ID 一行摊开不换行；可拉伸范围放宽。 */
export const DETAIL_WIDTH_MIN = 240
export const DETAIL_WIDTH_MAX = 560
export const DETAIL_WIDTH_DEFAULT = 420

/** 拖拽手柄样式（左侧边缘，竖条）。 */
const RESIZE_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: -3,
  top: 0,
  bottom: 0,
  width: 6,
  cursor: 'col-resize',
  zIndex: 95,
} as const

/** 明细面板：标题栏 + 所有者视图 + 扩展区块；左侧拖拽调宽。 */
export function DetailPanel({ node, instance, doc, ownerDetail, sections, title, onClose }: DetailPanelProps) {
  const close = (): void => onClose()
  const [width, setWidth] = useState<number>(DETAIL_WIDTH_DEFAULT)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    // 阻止冒泡到画布区域（否则 area 的空白按下会取消选中 → 面板消失）
    event.stopPropagation()
    dragRef.current = { startX: event.clientX, startWidth: width }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    // 向右拖 = 面板变宽（面板在右侧，拖手柄向左移动 = 变宽）
    const next = drag.startWidth + (drag.startX - event.clientX)
    setWidth(Math.min(DETAIL_WIDTH_MAX, Math.max(DETAIL_WIDTH_MIN, next)))
  }
  const onResizePointerUp = (): void => { dragRef.current = null }

  const style: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width,
    zIndex: 90,
    background: 'var(--dsw-alias-bg-layer-1)',
    borderLeft: '1px solid var(--dsw-alias-border-l2)',
    padding: '12px 14px',
    overflowY: 'auto',
    // 显式文字色走系统令牌（避免在画布浮层上下文继承浅色导致白字白底）
    color: 'var(--dsw-alias-label-primary)',
    cursor: 'default',
  }

  const onPanelPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    // 面板内任意按下（含未来新增元素）都不冒泡到画布区域，避免触发空白取消选中
    event.stopPropagation()
  }

  return createElement(
    'div',
    { 'data-dsh-canvas-detail': node.id, style, onPointerDown: onPanelPointerDown },
    [
      // 宽度调节手柄（左侧边缘；拖拽在 240–560 范围内调整）
      createElement('div', {
        key: 'resize',
        'data-dsh-detail-resize': '',
        style: RESIZE_HANDLE_STYLE,
        onPointerDown: onResizePointerDown,
        onPointerMove: onResizePointerMove,
        onPointerUp: onResizePointerUp,
      }),
      createElement(
        'div',
        { key: 'header', style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 } },
        [
          // workspace 节点：标题由明细身份区大字号呈现，header 不再重复显示（避免顶部两行）；
          // 其他节点（编排节点）标题仍在此展示（label 或 ref）
          node.kind !== 'workspace'
            ? createElement('strong', { key: 'title', style: { marginRight: 'auto' } }, title ?? (node.label !== undefined && node.label !== '' ? node.label : node.ref))
            : null,
          createElement(
            'button',
            { key: 'close', type: 'button', 'data-dsh-detail-close': '', onClick: close, style: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--dsw-alias-label-secondary)' } },
            '✕',
          ),
        ],
      ),
      ownerDetail !== undefined
        ? createElement(ownerDetail, { key: 'owner', node, instance, doc, close })
        : null,
      ...sections.map((section) => createElement(
        'section',
        { key: `${node.id}-${section.label.zh}`, 'data-dsh-detail-section': section.label.zh, style: { marginTop: 10 } },
        [
          createElement('h4', { key: 'label', style: { margin: '0 0 6px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, section.label.zh),
          createElement(section.render, { key: 'body', node, instance, doc, close }),
        ],
      )),
    ],
  )
}
