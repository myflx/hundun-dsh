/**
 * 右键菜单框架（T023）。
 *
 * 定位式浮层：给定坐标与菜单项，点击外部 / Escape 关闭；菜单项点击后先关
 * 闭再执行。动作由调用方合并（类型所有者 + registerNodeActions 扩展）。
 */
import { useEffect, useRef } from 'react'
import { createElement } from 'react'

export interface MenuItem {
  id: string
  label: string
  danger?: boolean
  run(): void
}

export interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose(): void
}

/** 右键菜单浮层（absolute 定位，zIndex 100）。 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [onClose])

  return createElement(
    'div',
    {
      ref,
      'data-dsh-canvas-menu': '',
      role: 'menu',
      style: {
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 100,
        minWidth: 150,
        // 背景/边框/圆角/阴影对齐原生 dsh 菜单（实测：bg=specific-menu、border-l1、12px、三层阴影）
        background: 'var(--dsw-specific-menu)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        padding: 4,
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: 'rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.02) 0px 0px 4px 0px, rgba(0, 0, 0, 0.08) 0px 12px 32px 0px',
      },
    },
    [
      // 菜单项悬停高亮（对齐原生 dsh 菜单：interactive-bg-hover）
      createElement('style', { key: 'hover', dangerouslySetInnerHTML: { __html: '[data-dsh-canvas-menu] [data-dsh-menu-item]:hover { background: var(--dsw-alias-interactive-bg-hover); }' } }),
      ...items.map((item) => createElement(
        'button',
        {
          key: item.id,
          'data-dsh-menu-item': item.id,
          role: 'menuitem',
          type: 'button',
          onClick: () => {
            onClose()
            item.run()
          },
          style: {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            // 不设 inline background（默认透明）——否则会覆盖 :hover 规则（inline 特异性最高）
            border: 'none',
            // 项样式对齐原生 dsh 菜单（实测：圆角 10px、padding 8px 10px、字号 14、行高 22）
            padding: '8px 10px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: '22px',
            color: item.danger === true ? 'var(--dsw-alias-state-danger)' : 'var(--dsw-alias-label-primary)',
          },
        },
        item.label,
      )),
    ],
  )
}
