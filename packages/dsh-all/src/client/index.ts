/**
 * dsh-all 客户端半区。
 *
 * 提供「hundun-dsh」设置页骨架：注册 settings.section 页面 + 声明子槽位
 * hundun.settings.item（供各插件注册自己的设置栏目）。当前为脚手架占位，
 * 页面注册由任务 T031 实现。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务与设置面的 Context 合并。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

/** 所需客户端服务（fiber inject 等待）。 */
export const inject = ['slots']

/** 聚合包客户端半区入口。 */
export function apply(_ctx: ClientContext): void {
  // T031：注册 settings.section「hundun-dsh」页面 + 声明子槽位 hundun.settings.item
}
