/**
 * dsh-workspace-canvas —— browser 半区（在 dsh web GUI 运行）。
 *
 * GUI 通过 window.__ModuleLoader__ 从 /plugins/dsh-workspace-canvas/client.js
 * 加载本半区。职责：
 * - apply-guard 防重复挂载（T006）；
 * - enabled 总开关（T033，平台限制修正）：客户端本地持久化（enabled-store）
 *   优先、组合配置兜底；false 时立即卸载画布本体（文档/注册服务/入口/控制器）；
 *   设置栏目常驻注册，用户始终可从设置页重新开启；
 * - 其余装配（文档存储 / ctx.canvas 注册服务 / 挂载监督器 / 控制器 / 按钮）
 *   集中在 CanvasRuntime.mount()。
 */
// 客户端根上下文：带 slots / sessions / workspaces 等客户端服务合并的类型。
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 类型合并：拉进 ctx.locale 服务（type-only）。
import type {} from '@deepseek-ai/dsh-client-locale/client'
// 类型合并：拉进 ctx.workspaces 服务（type-only）。
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { claimCanvasApply, releaseCanvasApply } from './apply-guard.ts'
import { en, zh, type CanvasKey } from './locales.ts'
import { CanvasRuntime } from './runtime.ts'
import { registerCanvasSettingsColumn } from './settings.ts'
import { getCanvasEnabled, subscribeCanvasEnabled } from './enabled-store.ts'

// 对外公开的注册契约类型（消费方插件经 '@hundun/dsh-workspace-canvas/client' 引用）。
export type {
  CanvasRegistry,
  NodeAction,
  NodeDetailProps,
  NodeDetailSection,
  NodeInstance,
  NodeTypeDefinition,
  NodeViewProps,
} from './canvas/registry.ts'

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

/** 需要的客户端服务：locale（文案）/ workspaces（工作区数据）/ sessions（会话运行状态）/
 *  slots（设置栏目注册）。sessions 在 inject 中声明：Cordis ctx 为 Proxy，未声明时访问
 *  ctx.sessions 会抛 "cannot get property without inject"（真机 bugfix）。 */
export const inject = ['locale', 'workspaces', 'sessions', 'slots']

/** 客户端半区配置（与宿主 Config 同值；enabled 总开关，组合配置兜底）。 */
export interface CanvasClientConfig {
  enabled?: boolean
}

/**
 * 浏览器半区入口。GUI 加载本 bundle 后调用 apply(ctx)。
 * @param ctx - 客户端根上下文（已注入 locale / workspaces / slots）。
 * @param config - 组合文件配置（enabled=false 时跳过画布本体挂载；用户设置优先）。
 */
export function apply(ctx: ClientContext, config?: CanvasClientConfig): void {
  // 防重复挂载：同页面重复 factory 执行只让首次生效（T006）。
  if (!claimCanvasApply()) return
  ctx.effect(() => releaseCanvasApply, 'workspace-canvas: apply claim')

  // 文案字典（enabled 关闭时仍注册，无副作用）。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workspace-canvas: dictionaries')

  // 运行时容器：enabled 决定挂载/卸载。
  const runtime = new CanvasRuntime(ctx)
  ctx.effect(() => () => runtime.dispose(), 'workspace-canvas: runtime')

  // enabled 联动（T033 修正）：用户设置（localStorage）优先，组合配置兜底。
  // 官方 settings 命名空间白名单为硬编码，第三方 namespace 无法走 settingsScope，
  // 故用 enabled-store（localStorage + 事件广播）。
  const applyEnabled = (enabled: boolean): void => {
    if (enabled) runtime.mount()
    else runtime.unmount()
  }
  const sync = (): void => {
    applyEnabled(getCanvasEnabled() ?? config?.enabled ?? true)
  }
  const unsub = subscribeCanvasEnabled(sync)
  ctx.effect(() => unsub, 'workspace-canvas: enabled subscription')
  sync()

  // 设置栏目常驻注册（不随 enabled 卸载）：关闭画布后用户仍可从设置页重新开启。
  ctx.effect(() => registerCanvasSettingsColumn(ctx), 'workspace-canvas: settings column')
}
