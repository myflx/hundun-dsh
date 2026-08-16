/**
 * 画布设置栏目（T032，平台限制修正）。
 *
 * 注册到 dsh-all 设置页「hundun-dsh」声明的子槽位 hundun.settings.item。
 * 开关读写 enabled-store（localStorage 持久化 + 事件广播）——官方 settings
 * 命名空间白名单为硬编码（第三方 namespace 无法暴露给浏览器设置客户端，
 * 见 enabled-store.ts 注释），故不走 settingsScope。宿主公告由组合配置控制。
 * 设置面缺席（槽位未声明）时静默跳过。
 */
import { createElement, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与 SlotMap（注册类型）。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { getCanvasEnabled, setCanvasEnabled, subscribeCanvasEnabled } from './enabled-store.ts'

/** 子槽位声明（与 dsh-all 同形拼写，避免依赖兄弟包；插槽为 list/root）。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'hundun.settings.item': { kind: 'list'; scope: 'root'; owner: { children?: never } }
  }
}

/** 画布设置栏目卡片：enabled 开关（本地持久化）。 */
export function CanvasSettingsCard() {
  const [enabled, setEnabled] = useState<boolean>(getCanvasEnabled() ?? true)
  useEffect(
    () => subscribeCanvasEnabled(() => setEnabled(getCanvasEnabled() ?? true)),
    [],
  )
  const toggle = (): void => {
    setCanvasEnabled(!enabled)
  }
  return createElement(
    'div',
    { 'data-dsh-canvas-settings-column': '', style: { padding: '8px 0' } },
    createElement(
      'label',
      { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 } },
      [
        createElement('span', { key: 'text' }, '启用画布'),
        createElement('input', {
          key: 'switch',
          type: 'checkbox',
          'data-dsh-canvas-enabled-switch': '',
          checked: enabled,
          onChange: toggle,
        }),
      ],
    ),
  )
}

/** 注册画布设置栏目到 dsh-all 设置页；返回 disposer（设置面缺席返回空操作）。 */
export function registerCanvasSettingsColumn(ctx: ClientContext): () => void {
  return ctx.slots.inject('hundun.settings.item', () => ctx.slots.register({
    name: 'hundun.settings.item',
    id: 'canvas',
    order: 10,
    inject: () => ({}),
  }, CanvasSettingsCard))
}
