/**
 * 右键菜单（T023）——改用 dsh 系统原生 Menu 组件渲染。
 *
 * 与侧边栏「操作」按钮弹出的菜单是同一个组件（@deepseek-ai/dsh-client-ui-primitives 的 Menu），
 * portal 到 body（不继承画布上下文样式），任何主题下与系统其他菜单完全一致。
 * 定位：portal + getAnchorRect 返回右键坐标（0 尺寸 rect）。
 */
import { createElement } from 'react'
import type { ComponentType } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
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

/** 右键菜单：系统原生 Menu 组件（portal + 右键坐标锚定）。 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  return createElement(Menu, {
    open: true,
    portal: true,
    // 锚点：隐藏 span（portal 模式定位用 getAnchorRect，锚点无需可见）
    anchor: createElement('span', { style: { display: 'none' } }),
    getAnchorRect: () => ({ left: x, top: y, width: 0, height: 0 }) as DOMRect,
    items: items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon !== undefined ? createElement(item.icon, { size: MENU_ICON_SIZE }) : undefined,
      danger: item.danger,
    })),
    onSelect: (id: string) => {
      const item = items.find((i) => i.id === id)
      onClose()
      item?.run()
    },
    onClose,
  })
}
