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
        background: 'var(--dsw-alias-surface-raised, #fff)',
        border: '1px solid var(--dsw-alias-border-l2, #ccc)',
        borderRadius: 8,
        padding: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,.15)',
      },
    },
    items.map((item) => createElement(
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
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          color: item.danger === true ? 'var(--dsw-alias-state-danger, #d64545)' : 'inherit',
        },
      },
      item.label,
    )),
  )
}
