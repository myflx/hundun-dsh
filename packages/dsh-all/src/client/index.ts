/**
 * dsh-all 客户端半区。
 *
 * 提供「hundun-dsh」设置页骨架（T031）：注册 settings.section 页面
 * （id `hundun-dsh`）+ 声明子槽位 hundun.settings.item（各插件注册自己的
 * 设置栏目，如画布的启用开关）。页面组件渲染子槽位内容。
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与设置面的 SlotMap 合并（settings.section 声明）。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

/** 设置页子槽位声明（画布等插件注册设置栏目的位置；list/root）。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'hundun.settings.item': { kind: 'list'; scope: 'root'; owner: { children?: never } }
  }
}

/** 页面 props：设置面板 close + 子槽位渲染器（slots 系统注入）。 */
export interface HundunSettingsPageProps {
  close(): void
  renderSlot: PropsRenderSlots<'hundun.settings.item'>['renderSlot']
}

/** 「hundun-dsh」设置页：标题 + 各插件栏目（子槽位渲染）。 */
export function HundunSettingsPage(props: HundunSettingsPageProps): ReactNode {
  const { renderSlot } = props
  return createElement(
    'div',
    { 'data-dsh-hundun-settings-page': '', style: { padding: '16px 20px' } },
    [
      createElement('h3', { key: 'title', style: { margin: '0 0 4px' } }, 'hundun-dsh'),
      createElement('p', { key: 'desc', style: { margin: '0 0 12px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)' } }, 'hundun-dsh 聚合插件配置'),
      createElement('div', { key: 'columns', style: { marginTop: 8 } }, renderSlot('hundun.settings.item', {})),
    ],
  )
}

/** 所需客户端服务（fiber inject 等待）。 */
export const inject = ['slots']

/** 「hundun-dsh」设置页导航 tab 标签（纯文字；图标由 nav override 提供，见 installNavIconOverride）。 */
export const HUNDUN_SETTINGS_LABEL = 'hundun-dsh'

/** Package（盒子）图标 SVG 源（feather，MIT）：16px 视口由 mask contain 缩放。 */
const PACKAGE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
const PACKAGE_ICON_MASK = `data:image/svg+xml,${encodeURIComponent(PACKAGE_ICON_SVG)}`

/**
 * 替换设置页导航 tab 图标（官方 shell 的 navIcon(id) 仅映射 models/agent-presets/plugins，
 * 其余 id 一律渲染通用齿轮 IconSettingsOutline16——与「设置」主 tab 相同，无注册扩展点）。
 * 方案：MutationObserver 给 label 含「hundun-dsh」的导航行打 data 标记 + 注入 CSS——
 * 隐藏该行默认 SVG，用 ::before + CSS mask 渲染 Package 图标（currentColor 单色，
 * 线条风格与原生图标一致，色调随主题）。
 * @returns disposer（移除样式与观察器）。
 */
export function installNavIconOverride(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-all'
  style.textContent = `
[data-dsh-hundun-nav] > svg { display: none; }
[data-dsh-hundun-nav]::before {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  vertical-align: -3px;
  background-color: currentColor;
  -webkit-mask: url("${PACKAGE_ICON_MASK}") center / contain no-repeat;
  mask: url("${PACKAGE_ICON_MASK}") center / contain no-repeat;
}
`
  document.head.appendChild(style)

  const mark = (): void => {
    for (const button of document.querySelectorAll<HTMLElement>('button')) {
      if (button.hasAttribute('data-dsh-hundun-nav')) continue
      if (button.textContent?.includes('hundun-dsh') === true) {
        button.setAttribute('data-dsh-hundun-nav', '')
      }
    }
  }
  const observer = new MutationObserver(mark)
  observer.observe(document.body, { childList: true, subtree: true })
  mark()

  return () => {
    observer.disconnect()
    style.remove()
  }
}

/** 聚合包客户端半区入口。 */
export function apply(ctx: ClientContext): void {
  // 声明感知注册：设置面板出现时挂载「hundun-dsh」页，折叠时自动回收。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'hundun-dsh',
    order: 30,
    label: HUNDUN_SETTINGS_LABEL,
    children: { 'hundun.settings.item': { kind: 'list', scope: 'root' } },
    inject: () => ({}),
  }, HundunSettingsPage))
  // 导航 tab 图标替换（齿轮 → 文本色星星），随 fiber 回收。
  ctx.effect(() => installNavIconOverride(), 'dsh-all: settings nav icon override')
}
