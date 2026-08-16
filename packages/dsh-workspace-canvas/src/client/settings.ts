/**
 * 画布设置栏目（T032）。
 *
 * 注册到 dsh-all 设置页「hundun-dsh」声明的子槽位 hundun.settings.item；
 * 绑定设置命名空间 hundun-canvas（enabled 开关，双半区实时联动，clarify Q1）。
 * 设置面缺席（binder undefined / 槽位未声明）时静默跳过，组合配置兜底。
 */
import { createElement, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与 SlotMap（注册类型）。
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** 画布设置区（与宿主 Config 同值；enabled 总开关双半区生效）。 */
export interface CanvasSettings {
  enabled?: boolean
}

/** 子槽位声明（与 dsh-all 同形拼写，避免依赖兄弟包；插槽为 list/root）。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'hundun.settings.item': { kind: 'list'; scope: 'root'; owner: { children?: never } }
  }
}

/** 画布设置栏目卡片：enabled 开关。 */
export function CanvasSettingsCard({ scope }: { scope: SettingsScope<CanvasSettings> }) {
  const [enabled, setEnabled] = useState<boolean>(scope.getSnapshot().value?.enabled ?? true)
  useEffect(
    () => scope.subscribe(() => setEnabled(scope.getSnapshot().value?.enabled ?? true)),
    [scope],
  )
  const toggle = (): void => {
    const next = !enabled
    setEnabled(next)
    void scope.set('enabled', next)
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
  const binder = ctx.get('settingsScope') as
    | { bind<T>(spec: { namespace: string }): SettingsScope<T> }
    | undefined
  if (binder === undefined) return () => {}
  const scope = binder.bind<CanvasSettings>({ namespace: 'hundun-canvas' })
  return ctx.slots.inject('hundun.settings.item', () => ctx.slots.register({
    name: 'hundun.settings.item',
    id: 'canvas',
    order: 10,
    inject: () => ({ scope }),
  }, CanvasSettingsCard))
}
