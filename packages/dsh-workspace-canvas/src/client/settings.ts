/**
 * 画布设置页（自持 settings.section）。
 *
 * 画布自行注册官方设置面页面（settings.section, id `workspace-canvas`），
 * 不再依赖 dsh-all 聚合设置页骨架与 hundun.settings.item 子槽位。
 * 分组：「视图」（画布开关 + 背景风格）与「自动归档」（archive-store，005）。
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
import { ArchivePolicyFields } from './archive-controls.tsx'
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
const SUBTITLE: React.CSSProperties = {
  margin: '14px 0 8px',
  paddingTop: 12,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-tertiary)',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
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

/** 画布设置页卡片：分组「视图」+「自动归档」（均本地持久化）。 */
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
      // 组一 · 视图（开关 + 背景风格）
      createElement('div', { key: 'group-view', 'data-dsh-settings-group': 'view', style: GROUP }, [
        createElement('h4', { key: 'title', style: GROUP_TITLE }, '视图'),
        createElement(
          'label',
          { key: 'canvas-enabled', style: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 } },
          [
            createElement('span', { key: 'text', style: { flex: 1 } }, [
              createElement('span', { key: 'name', style: { display: 'block' } }, '画布视图'),
              createElement('span', { key: 'desc', style: STYLE_DESC }, '在工作区中显示画布入口'),
            ]),
            createElement('input', {
              key: 'switch',
              type: 'checkbox',
              'data-dsh-canvas-enabled-switch': '',
              checked: enabled,
              onChange: toggle,
            }),
          ],
        ),
        ...(enabled
          ? [
            createElement('h5', { key: 'background-title', style: SUBTITLE }, '画布背景风格'),
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
          ]
          : []),
      ]),
      // 组二 · 自动归档策略（005：全局默认，即改即存）
      createElement('div', { key: 'group-archive', 'data-dsh-settings-group': 'archive', style: GROUP }, [
        createElement('h4', { key: 'title', style: GROUP_TITLE }, '自动归档'),
        createElement(ArchivePolicyFields, { key: 'policy', config: archive, onPatch: patchArchive, dataPrefix: 'global' }),
      ]),
    ],
  )
}

/** 画布设置页导航 tab 标签（本地化；随挂载语言取字典）。 */
export function canvasSettingsLabel(): string {
  return dictionary()['canvas.settings'] ?? '工作区'
}

const FOLDER_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 8h18"/></svg>'
const FOLDER_ICON_MASK = `data:image/svg+xml,${encodeURIComponent(FOLDER_ICON_SVG)}`

/** 将设置导航默认齿轮替换为文件夹图标；返回值绑定到插件 fiber。 */
export function installCanvasNavIconOverride(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-workspace-canvas'
  style.textContent = `
[data-dsh-workspace-nav] > svg { display: none; }
[data-dsh-workspace-nav]::before {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  flex: none;
  vertical-align: -3px;
  background-color: currentColor;
  -webkit-mask: url("${FOLDER_ICON_MASK}") center / contain no-repeat;
  mask: url("${FOLDER_ICON_MASK}") center / contain no-repeat;
}
`
  document.head.appendChild(style)

  const mark = (): void => {
    const label = canvasSettingsLabel()
    for (const button of document.querySelectorAll<HTMLElement>('button')) {
      if (button.hasAttribute('data-dsh-workspace-nav')) continue
      // 只匹配宿主导航按钮：画布卡片即使包含同名文本，也不会被替换图标。
      if (button.querySelector('svg') === null) continue
      if (button.textContent?.trim() === label) button.setAttribute('data-dsh-workspace-nav', '')
    }
  }
  const observer = new MutationObserver(mark)
  observer.observe(document.body, { childList: true, subtree: true })
  mark()

  return () => {
    observer.disconnect()
    document.querySelectorAll('[data-dsh-workspace-nav]').forEach((node) => node.removeAttribute('data-dsh-workspace-nav'))
    style.remove()
  }
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
