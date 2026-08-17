/**
 * 工作区展示标题计算（003-detail-panel-redesign 补充）。
 *
 * 未命名工作区的默认标题 = 路径的文件夹名（如 /home/user/proj → proj）；
 * 路径也缺失时才回退「未命名工作区」。供详情面板标题与明细身份区共用，
 * 保证两处展示一致。
 */
/** 完全无标题且无路径时的兜底占位。 */
export const UNNAMED_WORKSPACE = '未命名工作区'

/** 取路径最后一段（文件夹名）；支持 / 与 \ 分隔、尾部斜杠、空路径。 */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter((p) => p !== '')
  return parts.length > 0 ? parts[parts.length - 1] ?? '' : ''
}

/** 工作区展示标题：自定义标题 → 文件夹名 → 「未命名工作区」。 */
export function workspaceDisplayTitle(title: string, path: string): string {
  const trimmed = title.trim()
  if (trimmed !== '') return trimmed
  const folder = folderName(path)
  if (folder !== '') return folder
  return UNNAMED_WORKSPACE
}
