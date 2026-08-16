/**
 * dsh-workspace-canvas —— host 半区（在 DSH 宿主进程运行）。
 *
 * 本插件是纯浏览器插件：所有 UI 逻辑（搜索框按钮、中间区域画布、
 * 工作区数据渲染）都在 browser 半区（src/client/）。宿主半区只做一件
 * 事：系统提示词公告，让每个 agent 都知道画布视图存在、如何协作。
 * 写法与 dsh-demo-greeter 完全一致（ctx.systemPrompt.section）。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import z from 'schemastery'

/** 插件 id（与 cordis.patch.yml 的 id 一致）。 */
export const name = 'hundun-workspace-canvas'

/** 需要的宿主服务：systemPrompt（公告）。 */
export const inject = ['systemPrompt']

/** 公告段在工具指引带里的排序。 */
const SECTION_ORDER = 310

/** 插件配置，schemastery 校验。 */
export interface Config {
  /** 总开关（公告）。 */
  enabled?: boolean
  /** 是否向 agent 公告本插件。 */
  announceToAgent?: boolean
}

/** 与 Config 同名的运行时 schema。 */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
})

/** 面向模型的中文公告。 */
export const GUIDANCE = '本机已安装 dsh-workspace-canvas 插件（DSH Web GUI 的工作区画布视图）：侧边栏工作区搜索框内有「画布视图」按钮；点击后在中间区域打开画布，自动渲染全部工作区（标题 / 路径 / 会话数），点击工作区卡片即切换进入该工作区的新会话。数据来自官方 workspaces feed（ctx.workspaces.list）。用户提到「工作区画布 / 画布视图 / workspace canvas」时即指本插件，请据此协作。'

/**
 * 插件入口。
 * @param ctx - 宿主插件上下文（已注入 systemPrompt）。
 * @param config - 解析后的插件配置。
 */
export function apply(ctx: Context, config?: Config): void {
  const resolve = (): Config => ({
    enabled: config?.enabled ?? true,
    announceToAgent: config?.announceToAgent ?? true,
  })

  let disposeSection: (() => void) | undefined
  const sync = (): void => {
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    const value = resolve()
    if (!value.enabled || !value.announceToAgent) return
    disposeSection = ctx.systemPrompt.section({
      name: 'plugin:dsh-workspace-canvas',
      order: SECTION_ORDER,
      text: GUIDANCE,
    })
  }
  sync()
}
