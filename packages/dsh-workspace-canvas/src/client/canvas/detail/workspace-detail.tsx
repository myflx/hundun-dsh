/**
 * 工作区明细内容（T027，clarify Q2）。
 *
 * 基础信息：标题 / 路径 / 会话数 / 最近活跃标记；**不列会话条目**（跳转侧边栏
 * 会话列表由既有能力承载，面板提供入口按钮）。
 */
import { createElement } from 'react'

export interface WorkspaceDetailProps {
  /** feed 投影实例（标题/路径/会话数来自官方数据）。 */
  view: { title: string; path: string; sessionIds: ReadonlyArray<string> }
  recent: boolean
  /** 跳转侧边栏会话列表（画布关闭并回到对话）。 */
  onJumpSidebar(): void
}

const ROW: React.CSSProperties = { fontSize: 13, margin: '4px 0', color: 'var(--dsw-alias-label-secondary, #555)' }

/** 工作区明细：基础信息 + 会话数 + 侧边栏入口。 */
export function WorkspaceDetail({ view, recent, onJumpSidebar }: WorkspaceDetailProps) {
  return createElement(
    'div',
    { 'data-dsh-workspace-detail': '' },
    [
      createElement('div', { key: 'title', style: ROW }, `标题：${view.title}`),
      createElement('div', { key: 'path', style: ROW }, `路径：${view.path}`),
      createElement('div', { key: 'sessions', style: ROW }, `会话：${view.sessionIds.length} 个`),
      recent ? createElement('div', { key: 'recent', style: { ...ROW, color: 'var(--dsw-alias-state-business-primary, #4a7)' } }, '最近活跃') : null,
      createElement(
        'button',
        {
          key: 'jump',
          type: 'button',
          'data-dsh-jump-sidebar': '',
          onClick: onJumpSidebar,
          style: { marginTop: 10, border: '1px solid var(--dsw-alias-border-l2, #ccc)', background: 'transparent', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
        },
        '在侧边栏查看会话',
      ),
    ],
  )
}
