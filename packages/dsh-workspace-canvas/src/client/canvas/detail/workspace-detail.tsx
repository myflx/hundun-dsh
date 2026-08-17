/**
 * 工作区明细内容（T027 重设计，003-detail-panel-redesign）。
 *
 * 三块区域（卡片式明显划分）：身份区（顶行，大字号标题 + 最近活跃徽标）→ 基本信息区
 * （目录 / 路径 / 工作区 ID，键值对）→ 会话信息区（会话数量列表：总数/活跃/归档/运行中）。
 * 随机码（workspaceId）不再裸显示：无标题时用路径文件夹名（workspace-title），路径也缺时
 * 才回退「未命名工作区」；ID 以「工作区 ID」标签 + 说明呈现，支持复制。
 * 样式全部走系统令牌（背景分层 / 边框 / primary-secondary-tertiary 文字色）。
 */
import { createElement, useEffect, useRef, useState } from 'react'
import { folderName, workspaceDisplayTitle } from './workspace-title.ts'

export interface WorkspaceDetailProps {
  /** feed 投影实例（标题/路径/会话数/工作区 ID 来自官方数据）。 */
  view: { title: string; path: string; sessionIds: ReadonlyArray<string>; workspaceId: string }
  recent: boolean
  /** 会话数量统计（调用方计算）：总数 / 活跃 / 归档 / 运行中。 */
  sessionStats: { total: number; active: number; archived: number; running: number }
}

/** 卡片式分区：明显划分三块区域（身份区为顶行，其余两区为卡片）。 */
const CARD: React.CSSProperties = {
  marginBottom: 14,
  padding: '10px 12px',
  background: 'var(--dsw-alias-bg-layer-2)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
}
const SECTION_TITLE: React.CSSProperties = {
  margin: '0 0 8px',
  paddingBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-tertiary)',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}
const KV: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, margin: '5px 0', fontSize: 13 }
const LABEL: React.CSSProperties = {
  flex: '0 0 64px',
  color: 'var(--dsw-alias-label-tertiary)',
  lineHeight: '20px',
}
const VALUE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: 'var(--dsw-alias-label-primary)',
  lineHeight: '20px',
  wordBreak: 'break-word',
}
const BADGE: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: 11,
  lineHeight: '18px',
  color: 'var(--dsw-alias-state-business-primary)',
  background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent)',
  border: '1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent)',
}
const ID_ROW: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '5px 0', fontSize: 13 }
const CODE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '2px 8px',
  fontSize: 12,
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-bg-layer-2)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 4,
  wordBreak: 'break-all',
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
}
const COPY_BTN: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '1px 10px',
  fontSize: 12,
  lineHeight: '20px',
  cursor: 'pointer',
  color: 'var(--dsw-alias-label-secondary)',
  background: 'var(--dsw-alias-bg-layer-2)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 4,
}
const HINT: React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }
const TABLE: React.CSSProperties = {
  width: '100%',
  margin: '4px 0',
  borderCollapse: 'collapse',
  fontSize: 13,
  textAlign: 'center',
}
const TH: React.CSSProperties = {
  padding: '5px 4px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-tertiary)',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const TD: React.CSSProperties = {
  padding: '6px 4px',
  color: 'var(--dsw-alias-label-primary)',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
  fontVariantNumeric: 'tabular-nums',
}
const TD_RUNNING: React.CSSProperties = {
  ...TD,
  color: 'var(--dsw-alias-state-business-primary)',
  fontWeight: 600,
}

/** 工作区明细：身份区 / 基本信息区 / 标识区；ID 语义化 + 复制。 */
export function WorkspaceDetail({ view, recent, sessionStats }: WorkspaceDetailProps) {
  const [copied, setCopied] = useState<boolean>(false)
  const idRef = useRef<HTMLElement | null>(null)

  // 复制成功提示 1.5s 后自动复位；组件卸载时清理 timer（fiber 回收）。
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copyId = (): void => {
    // 剪贴板可用 → 复制并反馈；被拒绝 → 降级全选文本（手动 Ctrl+C）。
    if (navigator.clipboard !== undefined) {
      navigator.clipboard.writeText(view.workspaceId).then(
        () => setCopied(true),
        () => selectIdText(),
      )
      return
    }
    selectIdText()
  }
  const selectIdText = (): void => {
    const el = idRef.current
    if (el === null) return
    const range = document.createRange()
    range.selectNodeContents(el)
    const selection = window.getSelection()
    if (selection !== null) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  // 标题：自定义标题 → 路径文件夹名 → 「未命名工作区」（不裸显示随机码）
  const title = workspaceDisplayTitle(view.title, view.path)

  return createElement(
    'div',
    { 'data-dsh-workspace-detail': '' },
    [
      // 区域一 · 身份区（顶行）：无分区标题，大字号标题（或语义占位）+ 最近活跃徽标
      createElement('section', { key: 'identity', 'data-dsh-ws-section': 'identity', style: { marginBottom: 14 } }, [
        createElement(
          'div',
          { key: 'body', style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          [
            createElement('strong', { key: 'title', style: { fontSize: 18, lineHeight: '26px', color: 'var(--dsw-alias-label-primary)' } }, title),
            recent ? createElement('span', { key: 'recent', style: BADGE }, '最近活跃') : null,
          ],
        ),
      ]),
      // 区域二 · 基本信息区（卡片）：仅 目录 / 路径 / 工作区 ID
      createElement('section', { key: 'info', 'data-dsh-ws-section': 'info', style: CARD }, [
        createElement('h4', { key: 'label', style: SECTION_TITLE }, '基本信息'),
        createElement('div', { key: 'dir', style: KV }, [
          createElement('span', { key: 'k', style: LABEL }, '目录'),
          // 目录 = 路径的文件夹名（bugfix：不是工作区显示标题；标题在顶行身份区展示）
          createElement('span', { key: 'v', style: VALUE }, folderName(view.path) !== '' ? folderName(view.path) : '未知目录'),
        ]),
        createElement('div', { key: 'path', style: KV }, [
          createElement('span', { key: 'k', style: LABEL }, '路径'),
          createElement('span', { key: 'v', style: VALUE }, view.path.trim() === '' ? '未知路径' : view.path),
        ]),
        createElement('div', { key: 'id', style: ID_ROW }, [
          createElement('span', { key: 'k', style: LABEL }, '工作区 ID'),
          createElement('code', { key: 'v', ref: idRef, style: CODE, 'data-dsh-ws-id': '' }, view.workspaceId),
          createElement(
            'button',
            { key: 'copy', type: 'button', 'data-dsh-ws-copy': '', onClick: copyId, style: COPY_BTN },
            copied ? '已复制' : '复制',
          ),
        ]),
        createElement('p', { key: 'hint', style: HINT }, '内部标识，用于唯一区分工作区；不会随标题重命名改变。'),
      ]),
      // 区域三 · 会话信息区（卡片）：会话数量列表（总数 / 活跃 / 归档 / 运行中）
      createElement('section', { key: 'sessions-card', 'data-dsh-ws-section': 'sessions', style: CARD }, [
        createElement('h4', { key: 'label', style: SECTION_TITLE }, '会话'),
        createElement(
          'table',
          { key: 'stats', 'data-dsh-ws-sessions': '', style: TABLE },
          [
            createElement('thead', { key: 'head' }, [
              createElement('tr', { key: 'row' }, [
                createElement('th', { key: 'total', style: TH }, '总数'),
                createElement('th', { key: 'active', style: TH }, '活跃'),
                createElement('th', { key: 'archived', style: TH }, '归档'),
                createElement('th', { key: 'running', style: TH }, '运行中'),
              ]),
            ]),
            createElement('tbody', { key: 'body' }, [
              createElement('tr', { key: 'row' }, [
                createElement('td', { key: 'total', style: TD }, `${sessionStats.total}`),
                createElement('td', { key: 'active', style: TD }, `${sessionStats.active}`),
                createElement('td', { key: 'archived', style: TD }, `${sessionStats.archived}`),
                createElement('td', { key: 'running', style: TD_RUNNING }, `${sessionStats.running}`),
              ]),
            ]),
          ],
        ),
      ]),
    ],
  )
}
