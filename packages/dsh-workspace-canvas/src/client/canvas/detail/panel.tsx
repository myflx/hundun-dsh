/**
 * 右侧明细面板框架（T026）。
 *
 * 组合渲染：类型所有者 detail（若有）+ 扩展区块（registerNodeDetailSection，
 * 按 order 排序，由调用方合并）。面板在画布视图内部右侧固定列。
 */
import { createElement } from 'react'
import type { ComponentType } from 'react'
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
  onClose(): void
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 280,
  zIndex: 90,
  background: 'var(--dsw-alias-surface-raised, #fff)',
  borderLeft: '1px solid var(--dsw-alias-border-l2, #ccc)',
  padding: '12px 14px',
  overflowY: 'auto',
}

/** 明细面板：标题栏 + 所有者视图 + 扩展区块。 */
export function DetailPanel({ node, instance, doc, ownerDetail, sections, onClose }: DetailPanelProps) {
  const close = (): void => onClose()
  return createElement(
    'div',
    { 'data-dsh-canvas-detail': node.id, style: PANEL_STYLE },
    [
      createElement(
        'div',
        { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
        [
          createElement('strong', { key: 'title' }, node.label ?? node.ref),
          createElement(
            'button',
            { key: 'close', type: 'button', 'data-dsh-detail-close': '', onClick: close, style: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 } },
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
          createElement('h4', { key: 'label', style: { margin: '0 0 6px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)' } }, section.label.zh),
          createElement(section.render, { key: 'body', node, instance, doc, close }),
        ],
      )),
    ],
  )
}
