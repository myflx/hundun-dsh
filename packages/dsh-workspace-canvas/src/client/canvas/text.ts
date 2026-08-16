/** 画布 UI 文案辅助：按文档语言取字典并插值。 */
import { dictionary, t } from '../locales.ts'

/** 翻译一个键（可选 {name} 模板参数）。 */
export function canvasText(key: string, values?: Record<string, string | number>): string {
  return t(dictionary(), key, values)
}
