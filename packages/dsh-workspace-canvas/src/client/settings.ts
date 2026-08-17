/**
 * 画布设置栏目（T032 平台限制修正；004 重设计为分组布局）。
 *
 * 注册到 dsh-all 设置页「hundun-dsh」声明的子槽位 hundun.settings.item。
 * 分组：第一组「启用」（画布开关，enabled-store）；第二组「画布背景风格」
 * （单选，background-store，风格来自 background-styles 注册表）。
 * 读写均走 localStorage 持久化 + 事件广播（官方 settings 命名空间白名单硬编码，
 * 第三方 namespace 无法暴露给浏览器设置客户端，见 enabled-store.ts 注释）。
 * 设置面缺席（槽位未声明）时静默跳过。
 */
import { createElement, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与 SlotMap（注册类型）。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { getCanvasEnabled, setCanvasEnabled, subscribeCanvasEnabled } from './enabled-store.ts'
import { getCanvasBackgroundId, setCanvasBackgroundId, subscribeCanvasBackgroundId } from './background-store.ts'
import { CANVAS_BACKGROUND_STYLES, DEFAULT_BACKGROUND_ID } from './canvas/background-styles.ts'
import {
  getGlobalArchiveConfig,
  setGlobalArchiveConfig,
  subscribeArchiveConfig,
  type AutoArchiveConfig,
} from './archive-store.ts'

/** 子槽位声明（与 dsh-all 同形拼写，避免依赖兄弟包；插槽为 list/root）。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'hundun.settings.item': { kind: 'list'; scope: 'root'; owner: { children?: never } }
  }
}

const GROUP: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px',
  background: 'var(--dsw-alias-bg-layer-2)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
}
const GROUP_TITLE: React.CSSProperties = {
  margin: '0 0 8px',
  paddingBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-tertiary)',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const STYLE_OPTION: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 0',
  cursor: 'pointer',
  fontSize: 13,
}
const STYLE_NAME: React.CSSProperties = { flex: '0 0 auto', minWidth: 64 }
const STYLE_DESC: React.CSSProperties = { flex: 1, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }

/** 画布设置栏目卡片：分组「启用」+「画布背景风格」（均本地持久化）。 */
export function CanvasSettingsCard() {
  const [enabled, setEnabled] = useState<boolean>(getCanvasEnabled() ?? true)
  const [backgroundId, setBackgroundId] = useState<string>(getCanvasBackgroundId() ?? DEFAULT_BACKGROUND_ID)
  useEffect(
    () => subscribeCanvasEnabled(() => setEnabled(getCanvasEnabled() ?? true)),
    [],
  )
  useEffect(
    () => subscribeCanvasBackgroundId(() => setBackgroundId(getCanvasBackgroundId() ?? DEFAULT_BACKGROUND_ID)),
    [],
  )
  const toggle = (): void => {
    setCanvasEnabled(!enabled)
  }
  const pickStyle = (id: string): void => {
    setCanvasBackgroundId(id)
  }
  // 归档全局默认（005）：即改即存
  const [archive, setArchive] = useState<AutoArchiveConfig>(getGlobalArchiveConfig())
  useEffect(
    () => subscribeArchiveConfig(() => setArchive(getGlobalArchiveConfig())),
    [],
  )
  const patchArchive = (patch: Partial<AutoArchiveConfig>): void => {
    setGlobalArchiveConfig({ ...archive, ...patch })
  }
  return createElement(
    'div',
    { 'data-dsh-canvas-settings-column': '', style: { padding: '8px 0' } },
    [
      // 组一 · 启用
      createElement('div', { key: 'group-enabled', 'data-dsh-settings-group': 'enabled', style: GROUP }, [
        createElement('h4', { key: 'title', style: GROUP_TITLE }, '启用'),
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
      ]),
      // 组二 · 画布背景风格（单选，来自注册表）
      createElement('div', { key: 'group-background', 'data-dsh-settings-group': 'background', style: GROUP }, [
        createElement('h4', { key: 'title', style: GROUP_TITLE }, '画布背景风格'),
        ...CANVAS_BACKGROUND_STYLES.map((style) => createElement(
          'label',
          { key: style.id, style: STYLE_OPTION, 'data-dsh-background-setting': style.id },
          [
            createElement('input', {
              key: 'radio',
              type: 'radio',
              name: 'canvas-background',
              checked: style.id === backgroundId,
              onChange: () => pickStyle(style.id),
            }),
            createElement('span', { key: 'name', style: STYLE_NAME }, style.name),
            createElement('span', { key: 'desc', style: STYLE_DESC }, style.description),
          ],
        )),
      ]),
      // 组三 · 自动归档（005：全局默认，即改即存）
      createElement('div', { key: 'group-archive', 'data-dsh-settings-group': 'archive', style: GROUP }, [
        createElement('h4', { key: 'title', style: GROUP_TITLE }, '自动归档'),
        createElement(
          'label',
          { key: 'enabled', style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 } },
          [
            createElement('span', { key: 'text' }, '启用自动归档'),
            createElement('input', {
              key: 'switch',
              type: 'checkbox',
              'data-dsh-archive-enabled': '',
              checked: archive.enabled,
              onChange: () => patchArchive({ enabled: !archive.enabled }),
            }),
          ],
        ),
        createElement(
          'label',
          { key: 'idle', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 } },
          [
            createElement('span', { key: 'text' }, '闲置天数'),
            createElement('input', {
              key: 'input',
              type: 'number',
              min: 1,
              'data-dsh-archive-idle-days': '',
              value: archive.idleDays,
              onChange: (event) => patchArchive({ idleDays: Number(event.currentTarget.value) || 30 }),
              style: { width: 70, padding: '2px 6px', fontSize: 13 },
            }),
          ],
        ),
        createElement(
          'label',
          { key: 'max', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 } },
          [
            createElement('span', { key: 'text' }, '会话数上限'),
            createElement('input', {
              key: 'input',
              type: 'number',
              min: 0,
              'data-dsh-archive-max-sessions': '',
              value: archive.maxSessions,
              onChange: (event) => patchArchive({ maxSessions: Math.max(0, Number(event.currentTarget.value) || 0) }),
              style: { width: 70, padding: '2px 6px', fontSize: 13 },
            }),
            createElement('span', { key: 'hint', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, '0=不限'),
          ],
        ),
      ]),
    ],
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
