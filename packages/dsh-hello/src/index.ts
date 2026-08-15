/**
 * 宿主 loader 入口：dsh-hello。
 *
 * 演示两个标准宿主扩展面：
 * 1. system-prompt 段落——向每个 agent 声明插件存在（挂载时注册，卸载时消失）；
 * 2. 模型工具——ctx.tools.register(defineTool(...))，供 agent 在会话中调用。
 */
import type { Context } from '@deepseek-ai/cordis'
// 类型导入：拉入 systemPrompt 服务的 Context 合并（ctx.systemPrompt 类型）。
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { greet } from './greet.ts'

/** 所需宿主服务（fiber inject 等待）。 */
export const inject = ['systemPrompt', 'tools']

/** 插件显示名。 */
export const name = 'hello'

/**
 * 注册问候段落与问候工具。
 * @param ctx - 插件上下文（systemPrompt / tools 已注入）。
 */
export function apply(ctx: Context): void {
  // 系统提示段落：agent 由此知道插件存在、能力与协作方式。
  ctx.systemPrompt.section({
    name: 'plugin:hundun-hello',
    order: 500,
    text: '本机已安装 hundun-dsh 示例插件（dsh-hello）：宿主侧注册 hello_greet 问候工具；'
      + '浏览器侧在侧边栏底部注册问候按钮。用户提到「hello / 示例插件 / 问候」时即指本插件，请据此协作。',
  })

  // 模型工具：hello_greet —— 返回问候语，可指定名字。
  ctx.tools.register(defineTool({
    name: 'hello_greet',
    description: '返回 hundun-dsh 示例插件的问候语。可传入名字问候特定的人。',
    parameters: {
      name: { type: 'string', description: '可选：问候谁，默认问候用户。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args: { name?: string }) {
      return { text: greet(args.name) }
    },
  }))
}
