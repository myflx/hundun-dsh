/**
 * 右键菜单框架（T023）。
 *
 * 定位式浮层：给定坐标与菜单项，点击外部 / Escape 关闭；菜单项点击后先关
 * 闭再执行。动作由调用方合并（类型所有者 + registerNodeActions 扩展）。
 * 样式与图标对齐 dsh 原生工作区操作菜单（侧边栏工作区行「操作」按钮弹出的
 * Menu 组件：specific-menu 背景、12px 圆角、三层阴影、项带系统图标）。
 */
import { useEffect, useRef } from 'react'
import { createElement } from 'react'
import type { ComponentType } from 'react'
// 系统图标（primitives 在客户端平台表；菜单项图标与原生工作区操作菜单同源）
import {
  IconEditOutline16,
  IconTrashOutline16,
  IconRightUpOutline16,
  IconPanelLeftOutline16,
  IconFolderOpenOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

/** 菜单项图标映射（按动作 id，与原生工作区操作菜单图标同款）。 */
export const MENU_ITEM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  enter: IconRightUpOutline16,
  detail: IconPanelLeftOutline16,
  rename: IconEditOutline16,
  archive: IconFolderOpenOutline16,
  delete: IconTrashOutline16,
}

export interface MenuItem {
  id: string
  label: string
  danger?: boolean
  /** 菜单项图标（系统 Icon*Outline16 同款；对齐原生工作区操作菜单）。 */
  icon?: ComponentType<{ size?: number }>
  run(): void
}

export interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose(): void
}

/** 菜单项图标尺寸（与原生 16px 图标一致）。 */
const MENU_ICON_SIZE = 16

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
        minWidth: 218,
        // 对齐原生 dsh 工作区操作菜单（实测：bg=specific-menu、border-l1、12px、三层阴影、minWidth 218）
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
            display: 'flex',
            alignItems: 'center',
            gap: 8,
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
            color: item.danger === true ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-primary)',
          },
        },
        [
          // 菜单项图标（系统 Icon*Outline16，颜色 currentColor 跟随项文字色）
          item.icon !== undefined
            ? createElement(item.icon, { key: 'icon', size: MENU_ICON_SIZE })
            : null,
          createElement('span', { key: 'label' }, item.label),
        ],
      )),
    ],
  )
}
