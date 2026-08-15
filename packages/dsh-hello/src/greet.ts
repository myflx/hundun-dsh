/** 纯函数问候逻辑（无外部依赖，便于单测）。 */
export function greet(name?: string): string {
  return `你好，${name ?? '朋友'}！这是来自 hundun-dsh 聚合项目的问候。`
}
