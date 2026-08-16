/**
 * dsh-workspace-canvas —— browser 半区（在 dsh web GUI 运行）。
 *
 * GUI 通过 window.__ModuleLoader__ 从 /plugins/dsh-workspace-canvas/client.js
 * 加载本半区。职责：
 * - apply-guard 防重复挂载（T006）；
 * - enabled 总开关双半区实时联动（T033，clarify Q1）：设置面（hundun-canvas
 *   命名空间）优先、组合配置兜底；false 时立即卸载全部画布效果；
 * - 其余装配（文档存储 / ctx.canvas 注册服务 / 挂载监督器 / 控制器 / 按钮 /
 *   设置栏目）集中在 CanvasRuntime.mount()。
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

/** 需要的客户端服务：locale（文案）/ workspaces（工作区数据）/ slots（设置栏目注册）。 */
export const inject = ['locale', 'workspaces', 'slots']

/** 客户端半区配置（与宿主 Config 同值；enabled 总开关双半区生效）。 */
export interface CanvasClientConfig {
  enabled?: boolean
}

/**
 * 浏览器半区入口。GUI 加载本 bundle 后调用 apply(ctx)。
 * @param ctx - 客户端根上下文（已注入 locale / workspaces / slots）。
 * @param config - 组合文件配置（enabled=false 时跳过全部挂载；设置面值优先）。
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

  const applyEnabled = (enabled: boolean): void => {
    if (enabled) runtime.mount()
    else runtime.unmount()
  }

  // 设置面联动（T033）：hundun-canvas 命名空间值优先，组合配置兜底。
  const binder = ctx.get('settingsScope') as
    | {
      bind<T>(spec: { namespace: string }): {
        getSnapshot(): { value?: T }
        subscribe(fn: () => void): () => void
      }
    }
    | undefined
  if (binder !== undefined) {
    const scope = binder.bind<{ enabled?: boolean }>({ namespace: 'hundun-canvas' })
    const sync = (): void => {
      applyEnabled(scope.getSnapshot().value?.enabled ?? config?.enabled ?? true)
    }
    const unsub = scope.subscribe(sync)
    ctx.effect(() => unsub, 'workspace-canvas: enabled subscription')
    sync()
  } else {
    // 无设置面：组合配置兜底（缺省 enabled=true）。
    applyEnabled(config?.enabled ?? true)
  }
}
