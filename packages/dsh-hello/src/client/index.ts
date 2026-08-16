/**
 * 浏览器半区入口：dsh-hello。
 *
 * 在侧边栏底部槽位（sidebar.footer.action，Settings 旁的加性动作位）挂一个
 * 问候按钮。失败策略：挂载问题只 log 不 throw——Web shell 在 apply 抛错时
 * 会整体启动失败，外部插件不得拖垮 GUI。
 */
// 客户端根上下文：带 slots / sessions / workspaces 等客户端服务合并的类型。
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型导入：拉入 slots 服务的 Context 合并（ctx.slots 类型）与 SlotMap 声明。
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// 类型导入：ui-sidebar 声明的 SlotMap 合并（sidebar.footer.action 槽位）。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { registerDemoNodeType } from './canvas-demo-node.tsx'
import { DemoButton } from './DemoButton.tsx'
import { HelloPanelController } from './panel.tsx'

/** 所需客户端服务（fiber inject 等待）。 */
export const inject = ['slots']

/**
 * 挂载侧边栏问候按钮。
 * @param ctx - 客户端根上下文（slots 已注入）。
 */
export function apply(ctx: ClientContext): void {
  // 互斥测试面板（T029）：对方面板，经问候按钮切换。
  const helloPanel = new HelloPanelController()
  helloPanel.start()
  ctx.effect(() => () => helloPanel.dispose(), 'dsh-hello: mutex test panel')

  // 声明感知注册：槽位声明出现时挂载，折叠/重声明时自动回收（slots.inject 处理）。
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'hundun-hello-demo',
    order: 100,
    inject: () => ({ togglePanel: () => helloPanel.toggle() }),
  }, DemoButton))

  // 画布演示节点（T021）：立即注册（画布缺席/晚到时经 canvas/ready 事件补注册），
  // 卸载时回收。注意 ctx.effect 回调是卸载钩子，不能包注册本身。
  const disposeDemo = registerDemoNodeType(ctx)
  ctx.effect(() => () => disposeDemo(), 'dsh-hello: demo canvas node')
}
