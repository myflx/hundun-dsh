/**
 * 画布设置页（自持 settings.section）。
 *
 * 画布自行注册官方设置面页面（settings.section, id `workspace-canvas`），
 * 不再依赖 dsh-all 聚合设置页骨架与 hundun.settings.item 子槽位。
 * 分组：第一组「启用」（画布开关，enabled-store）；第二组「画布背景风格」
 * （单选，background-store，风格来自 background-styles 注册表）；第三组
 * 「自动归档」（archive-store，005）。
 * 读写均走 localStorage 持久化 + 事件广播（官方 settings 命名空间白名单硬编码，
 * 第三方 namespace 无法暴露给浏览器设置客户端，见 enabled-store.ts 注释）。
 */
import { createElement, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与 SlotMap（注册类型）。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// 类型导入：拉入官方 settings.section 槽位契约（SlotMap 声明）。
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { getCanvasEnabled, setCanvasEnabled, subscribeCanvasEnabled } from './enabled-store.ts'
import { getCanvasBackgroundId, setCanvasBackgroundId, subscribeCanvasBackgroundId } from './background-store.ts'
import { CANVAS_BACKGROUND_STYLES, DEFAULT_BACKGROUND_ID } from './canvas/background-styles.ts'
import {
  getGlobalArchiveConfig,
  setGlobalArchiveConfig,
  subscribeArchiveConfig,
  type AutoArchiveConfig,
} from './archive-store.ts'
import { dictionary } from './locales.ts'

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

/** 画布设置页卡片：分组「启用」+「画布背景风格」+「自动归档」（均本地持久化）。 */
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
            createElement('span', { key: 'text' }, '画布视图'),
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
            createElement('span', { key: 'text' }, '闲置时长'),
            createElement('input', {
              key: 'input',
              type: 'number',
              min: 1,
              'data-dsh-archive-idle-days': '',
              value: archive.idleDays,
              onChange: (event) => patchArchive({ idleDays: Number(event.currentTarget.value) || 1 }),
              style: { width: 70, padding: '2px 6px', fontSize: 13 },
            }),
            createElement('select', {
              key: 'unit',
              'data-dsh-archive-idle-unit': '',
              value: archive.idleUnit ?? 'day',
              onChange: (event: { currentTarget: { value: string } }) => patchArchive({ idleUnit: event.currentTarget.value as 'day' | 'hour' | 'minute' }),
              style: { padding: '2px 4px', fontSize: 13 },
            }, [
              createElement('option', { key: 'day', value: 'day' }, '天'),
              createElement('option', { key: 'hour', value: 'hour' }, '小时'),
              createElement('option', { key: 'minute', value: 'minute' }, '分钟'),
            ]),
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

/** 画布设置页导航 tab 标签（本地化；随挂载语言取字典）。 */
export function canvasSettingsLabel(): string {
  return dictionary()['canvas.settings'] ?? '工作区'
}

/** 注册画布设置页到官方设置面（settings.section）；返回 disposer。 */
export function registerCanvasSettingsPage(ctx: ClientContext): () => void {
  return ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'workspace-canvas',
    order: 30,
    label: canvasSettingsLabel(),
    inject: () => ({}),
  }, CanvasSettingsCard))
}
