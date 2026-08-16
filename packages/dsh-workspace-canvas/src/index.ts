/**
 * dsh-workspace-canvas —— host 半区（在 DSH 宿主进程运行）。
 *
 * 本插件是纯浏览器插件：所有 UI 逻辑（搜索框按钮、中间区域画布、
 * 工作区数据渲染）都在 browser 半区（src/client/）。宿主半区职责：
 * 系统提示词公告 + 配置语义（T010）：
 * - `enabled` 总开关（双半区生效；客户端在 apply 时同样读取并跳过挂载）；
 * - `announceToAgent` 仅控制公告；
 * - 设置面联动：安装「hundun.canvas」设置命名空间（installSettingsSection），
 *   设置服务存在时以设置值为权威源并即时增删公告；不存在时回退组合配置。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'

/** 插件 id（与 cordis.patch.yml 的 id 一致）。 */
export const name = 'hundun-workspace-canvas'

/** 需要的宿主服务：systemPrompt（公告）。 */
export const inject = ['systemPrompt']

/** 公告段在工具指引带里的排序。 */
const SECTION_ORDER = 310

/** 插件配置，schemastery 校验。 */
export interface Config {
  /** 总开关（双半区生效：关公告 + 客户端跳过挂载）。 */
  enabled?: boolean
  /** 是否向 agent 公告本插件。 */
  announceToAgent?: boolean
}

/** 与 Config 同名的运行时 schema。 */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
})

/** 设置命名空间（客户端半区拼写同值，不依赖宿主包；官方限制 kebab-case）。 */
export const CANVAS_SETTINGS_NAMESPACE = settingsNamespace('hundun-canvas')

/** 面向模型的中文公告。 */
export const GUIDANCE = '本机已安装 dsh-workspace-canvas 插件（DSH Web GUI 的工作区画布视图）：侧边栏工作区搜索框内有「画布视图」按钮；点击后在中间区域打开画布，自动渲染全部工作区（标题 / 路径 / 会话数），点击工作区卡片即切换进入该工作区的新会话。数据来自官方 workspaces feed（ctx.workspaces.list）。用户提到「工作区画布 / 画布视图 / workspace canvas」时即指本插件，请据此协作。'

/** 公告段落名（插件 id 对齐）。 */
const SECTION_NAME = 'plugin:hundun-workspace-canvas'

/**
 * 插件入口。
 * @param ctx - 宿主插件上下文（已注入 systemPrompt）。
 * @param config - 解析后的插件配置（组合文件兜底值）。
 */
export function apply(ctx: Context, config?: Config): void {
  // 活动配置源：设置服务挂载后由 installSettingsSection 换成设置值，否则组合配置。
  let current: () => Config = () => config ?? {}

  let disposeSection: (() => void) | undefined
  const sync = (): void => {
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    const value = current()
    // 组合配置可能未经 schema 默认填充（手工上下文 / 兜底路径），undefined 视为默认 true。
    if ((value.enabled ?? true) === false) return
    if ((value.announceToAgent ?? true) === false) return
    disposeSection = ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: GUIDANCE,
    })
  }

  // 设置面联动：设置服务缺席时 installSettingsSection 不注册、钩子不触发，
  // 走组合配置兜底（与 dsh-web-ui 家族一致）。
  installSettingsSection(ctx, CANVAS_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: sync,
  })

  // 初始注册（组合配置）。
  sync()
}
