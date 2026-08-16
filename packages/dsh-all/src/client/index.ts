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

/** 聚合包客户端半区入口。 */
export function apply(ctx: ClientContext): void {
  // 声明感知注册：设置面板出现时挂载「hundun-dsh」页，折叠时自动回收。
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'hundun-dsh',
    order: 30,
    label: 'hundun-dsh',
    children: { 'hundun.settings.item': { kind: 'list', scope: 'root' } },
    inject: () => ({}),
  }, HundunSettingsPage))
}
