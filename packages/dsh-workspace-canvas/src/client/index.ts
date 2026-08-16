/**
 * dsh-workspace-canvas —— browser 半区（在 dsh web GUI 运行）。
 *
 * GUI 通过 window.__ModuleLoader__ 从 /plugins/dsh-workspace-canvas/client.js
 * 加载本半区。本插件不做槽位注册（中间区域没有外部槽位），而是：
 *
 *   1) 画布控制器（CanvasController）：DOM 层接管中间区域
 *      [data-pane="conversation"]，注入样式隐藏对话、显示画布；
 *   2) 搜索框按钮（mountSearchButton）：往侧边栏工作区搜索行注入
 *      「画布视图」按钮，点击 toggle 画布；
 *   3) 画布数据（CanvasView）：官方 workspaces feed（ctx.workspaces.list）
 *      自动渲染全部工作区。
 *
 * 需要注入的服务：workspaces（读工作区列表 + startSession）。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型合并：拉进 ctx.locale 服务（type-only）。
import type {} from '@deepseek-ai/dsh-client-locale/client'
// 类型合并：拉进 ctx.workspaces 服务（type-only）。
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { claimCanvasApply, releaseCanvasApply } from './apply-guard.ts'
import { CanvasController } from './canvas/controller.ts'
import { CanvasDocumentStore } from './canvas/document.ts'
import { MountSupervisor } from './canvas/mount-supervisor.ts'
import { installCanvasRegistry } from './canvas/registry.ts'
import { en, zh, type CanvasKey } from './locales.ts'
import { mountSearchButton } from './search-button.tsx'

/** 文案字典命名空间。 */
const NS = 'workspace-canvas'

/**
 * 把本插件的字典命名空间登记进 LocaleNamespaceMap（模块增强）：
 * ctx.locale.register 的类型化双参形式要求命名空间在此表里。
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'workspace-canvas': CanvasKey
  }
}

/** 需要的客户端服务：locale（文案）与 workspaces（工作区数据）。 */
export const inject = ['locale', 'workspaces']

/** 客户端半区配置（与宿主 Config 同值；enabled 总开关双半区生效）。 */
export interface CanvasClientConfig {
  enabled?: boolean
}

/**
 * 浏览器半区入口。GUI 加载本 bundle 后调用 apply(ctx)。
 * @param ctx - 客户端根上下文（已注入 locale / workspaces）。
 * @param config - 组合文件配置（enabled=false 时跳过全部挂载；设置面联动见 T032/T033）。
 */
export function apply(ctx: ClientContext, config?: CanvasClientConfig): void {
  // 防重复挂载：同页面重复 factory 执行只让首次生效（T006）。
  if (!claimCanvasApply()) return
  ctx.effect(() => releaseCanvasApply, 'workspace-canvas: apply claim')

  // 组合配置总开关（T010）：关闭时入口/画布/服务一律不挂载。
  if (config?.enabled === false) return

  // 画布文档存储 + ctx.canvas 注册服务（T008/T009）：消费方经 ctx.get('canvas') 接入。
  const store = new CanvasDocumentStore()
  ctx.effect(() => () => store.dispose(), 'workspace-canvas: document store')
  installCanvasRegistry(ctx, store)

  // 注册中英文案字典。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workspace-canvas: dictionaries')

  // 单一挂载监督器：画布挂载与按钮自愈共用（T007）。
  const supervisor = new MountSupervisor()
  supervisor.start()
  ctx.effect(() => () => supervisor.dispose(), 'workspace-canvas: mount supervisor')

  // 画布控制器：状态 + 中间区域挂载 + 单标记互斥（T005）。
  const canvas = new CanvasController(ctx)
  canvas.start(supervisor)
  ctx.effect(() => () => canvas.dispose(), 'workspace-canvas: canvas')

  // 搜索框「画布视图」按钮：toggle 画布（自愈注册到挂载监督器）。
  ctx.effect(() => mountSearchButton(canvas, supervisor), 'workspace-canvas: search button')
}
