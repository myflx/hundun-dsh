import { Fragment, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IWorkspaces, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-connection/client'
// 系统组件/图标（primitives 在客户端平台表；操作栏用系统 Button toolbar 变体，颜色交互系统保证）
import { Button, IconRefreshOutline16, IconPersonalizationOutline16, IconCheckOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CanvasDocumentStore, CanvasNode } from './document.ts'
import type { CanvasRegistryImpl } from './registry.ts'
import { ContextMenu, MENU_ITEM_ICONS, type MenuItem } from './menu.ts'
import { workspaceActions, type ConfirmRequest } from './workspace-actions.ts'
import { DetailPanel } from './detail/panel.tsx'
import { WorkspaceDetail } from './detail/workspace-detail.tsx'
import { workspaceDisplayTitle } from './detail/workspace-title.ts'
import { openWorkspaceSession } from './workspace-open.ts'
import { commitWorkspacePosition, readWorkspacePositions, avoidOverlap } from './workspace-position.ts'
import { defaultView, panBy, resetView, scenePoint, wheelZoomFactor, zoomAt, type ViewTransform } from './view-transform.ts'
import { canvasText } from './text.ts'
import { CANVAS_BACKGROUND_STYLES, DEFAULT_BACKGROUND_ID, getCanvasBackgroundStyle } from './background-styles.ts'
import { getCanvasBackgroundId, setCanvasBackgroundId, subscribeCanvasBackgroundId } from '../background-store.ts'
import { runAutoArchive } from '../archive-runner.ts'
import styles from './rename-dialog.module.css'
import {
  getOptimisticArchived,
  subscribeOptimisticArchived,
} from '../archive-store.ts'

/** 画布 props：官方 workspaces feed + 文档存储（布局持久化）+ 关闭回调。
 *  ctx/registry 可选（分区渲染编排节点需要；缺省时只渲染工作区卡片，便于隔离测试）。 */
export interface CanvasViewProps {
  workspaces: IWorkspaces
  store: CanvasDocumentStore
  onClose: () => void
  ctx?: ClientContext
  registry?: CanvasRegistryImpl
}

function RenameDialog({ initial, onResolve }: { initial: string; onResolve: (value: string | null) => void }) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onResolve(null) }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dsh-rename-title">
        <h2 id="dsh-rename-title" className={styles.title}>重命名工作区</h2>
        <p className={styles.description}>这里只修改工作区的展示名，不会修改工作区对应的目录名。</p>
        <input ref={inputRef} className={styles.input} value={value} aria-label="工作区展示名" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onResolve(value); if (event.key === 'Escape') onResolve(null) }} />
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => onResolve(null)}>取消</button>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => onResolve(value)}>确定</button>
        </div>
      </div>
    </div>
  )
}

/** 危险确认按钮：与官方删除确认同款（outline 变体 + 系统错误色文字）。 */
const CONFIRM_DANGER_BUTTON_STYLE: CSSProperties = {
  color: 'var(--dsw-alias-state-error-primary)',
}

/**
 * 二次确认弹窗：DSH 系统样式（Modal + 系统 Button），与官方删除确认同款。
 * 取消（×/遮罩/Escape/取消按钮）→ onResolve(false)；确认按钮 → onResolve(true)。
 */
export function ConfirmDialog({ request, onResolve }: { request: ConfirmRequest; onResolve: (ok: boolean) => void }) {
  return (
    <Modal
      open
      onClose={() => onResolve(false)}
      closeLabel="取消"
      title={request.title}
      description={request.description}
      footer={
        <>
          <Button variant="outline" onClick={() => onResolve(false)}>取消</Button>
          <Button
            variant="outline"
            style={request.danger === true ? CONFIRM_DANGER_BUTTON_STYLE : undefined}
            onClick={() => onResolve(true)}
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    />
  )
}

/** 编排节点渲染位置：绝对 = 工作区位置 + 区域内局部坐标（T019 分区渲染）。 */
export function partitionPosition(
  workspacePosition: { x: number; y: number },
  local: { x: number; y: number },
): { x: number; y: number } {
  return { x: workspacePosition.x + local.x, y: workspacePosition.y + local.y }
}

/** 网格步长（px）。 */
const GRID = 24
/** 自动布局参数：每行列数、卡片步进（宽 + 间距）。 */
const AUTO_COLS = 4
const CARD_STEP_X = 216
const CARD_STEP_Y = 112
const EMPTY_SESSION_STATE = { byId: {} as Record<string, { running?: boolean; blank?: boolean }> }
const EMPTY_SESSION_SUBSCRIBE = (): (() => void) => () => {}
/** 拖拽超过该距离视为拖动（否则算点击进入）。 */
const DRAG_THRESHOLD = 5

const WRAPPER_STYLE = {
  alignItems: 'stretch',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  padding: '0',
  position: 'relative',
} as const

const HEADER_STYLE = {
  alignItems: 'center',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
  display: 'flex',
  flex: 'none',
  justifyContent: 'space-between',
  padding: '10px 20px',
} as const

const TITLE_STYLE = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
} as const

const SUBTITLE_STYLE = {
  fontSize: '12px',
  color: 'var(--dsw-alias-label-tertiary)',
  marginTop: '2px',
} as const

const CLOSE_STYLE = {
  background: 'var(--dsw-alias-interactive-bg-hover)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '8px',
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '6px 12px',
} as const

/** 画布区域：未变换的坐标参考层，铺满剩余空间；overflow hidden（平移代替滚动）。
 *  无限画布：底色铺满；网格层与节点层分离（见下），平移永不露白。 */
const CANVAS_STYLE: CSSProperties = {
  flex: 1,
  minHeight: '240px',
  overflow: 'hidden',
  position: 'relative',
  touchAction: 'none',
  // 空白区域手型光标（拖拽平移中由 panning 状态切 grabbing）
  cursor: 'grab',
} as const

/** 背景层样式由 background-styles 注册表提供（网格/点阵/纯色/渐变/暗色网格/蓝图）；
 *  图案类平移取模跟随（周期 = GRID），铺满类固定。节点层独立于背景层。 */
const NODE_LAYER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  transformOrigin: '0 0',
  zIndex: 1,
} as const

/** 画布底部操作栏（对齐 参考实现 canvas-controls）：四图标按钮（缩小/重置/放大/刷新）。
 *  复用系统设计令牌（--dsw-alias-*），与系统控件视觉一致；低干扰浮层。 */
const ACTION_BAR_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 70,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 6px',
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  whiteSpace: 'nowrap',
} as const

function toolButton(label: string): CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 13,
    lineHeight: 1,
  }
}

/** 背景风格切换面板（操作栏上方弹出）。 */
const BACKGROUND_PANEL_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  right: 0,
  width: 220,
  padding: 6,
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
  zIndex: 75,
} as const

const BACKGROUND_OPTION_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 6,
  textAlign: 'left',
} as const

/** ── 操作栏按钮颜色（系统 Button toolbar 结构/圆角/hover 背景系统保证；
 *   颜色覆盖为用户要求的默认灰 → hover 白；特异性高于 Button class 规则） ── */
const ACTION_BAR_HOVER_CSS = `
[data-dsh-action-bar] button { color: var(--dsw-alias-label-tertiary); }
[data-dsh-action-bar] button:hover { color: var(--dsw-alias-label-primary); }
`

/** ── 操作栏图标（内联 SVG，lucide 同款 path，ISC 开源；颜色走 currentColor = 系统令牌） ── */

/** 缩小（参考实现 ZoomOut）：放大镜 + 减号。 */
function IconZoomOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

/** 重置（参考实现 LocateFixed）：十字准星 + 中心点。 */
function IconLocateFixed() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** 放大（参考实现 ZoomIn）：放大镜 + 加号。 */
function IconZoomIn() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

/** 刷新（系统图标 IconRefreshOutline16，与原生同款）。 */
function IconRefreshAction() {
  return <IconRefreshOutline16 size={16} />
}

const CARD_STYLE: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '12px',
  boxSizing: 'border-box',
  cursor: 'grab',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '12px 14px',
  position: 'absolute',
  textAlign: 'left',
  touchAction: 'none',
  userSelect: 'none',
  width: '200px',
} as const

const CARD_TITLE_STYLE = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: '14px',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const CARD_PATH_STYLE = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '11px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const CARD_META_STYLE = {
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: '12px',
} as const

const EMPTY_STYLE = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '13px',
  padding: '32px 16px',
  textAlign: 'center',
} as const

/** 拖拽中的卡片位置表：workspaceId -> 相对画布容器的坐标。 */
type Positions = Record<string, { x: number; y: number }>

/** 未拖过的工作区自动布局坐标。 */
function autoPosition(index: number): { x: number; y: number } {
  return {
    x: (index % AUTO_COLS) * CARD_STEP_X + 12,
    y: Math.floor(index / AUTO_COLS) * CARD_STEP_Y + 12,
  }
}

/** 会话运行状态查询面（ctx.sessions 可能缺省——测试/无服务时安全降级为无运行中）。 */
interface SessionRunningLookup {
  sessions?: { list?: { getSnapshot?: () => { byId?: Record<string, { running?: boolean; blank?: boolean }> } } }
}

/**
 * 计算一个工作区的会话统计：总数 / 活跃（未归档）/ 归档 / 运行中。
 * 可见会话来自 sessions 服务的 blank 位；归档来自 workspaces feed 的 archivedSessionIds；
 * 运行中来自 sessions 服务的 running 位。
 * 双保险：inject 已声明 sessions（真机）；此处 try/catch 兜底——Cordis ctx 是 Proxy，
 * 未注入时属性 getter 直接抛错（可选链无法捕获），捕获后按服务不可得降级为 0。
 */
export function workspaceSessionStats(
  sessionIds: ReadonlyArray<string>,
  archived: ReadonlySet<string>,
  ctx: unknown,
): { total: number; active: number; archived: number; running: number } {
  let byId: Record<string, { running?: boolean; blank?: boolean }> | undefined
  try {
    byId = (ctx as SessionRunningLookup | undefined)?.sessions?.list?.getSnapshot?.().byId
  } catch {
    byId = undefined
  }
  // DSH 的 session.list 保留空白会话用于“新会话”复用，但侧边栏和工作区视图都不展示它。
  const visibleSessionIds = sessionIds.filter((id) => byId?.[String(id)]?.blank !== true)
  const total = visibleSessionIds.length
  let archivedCount = 0
  let runningCount = 0
  for (const id of visibleSessionIds) {
    const key = String(id)
    if (archived.has(key)) archivedCount += 1
    if (byId?.[key]?.running === true) runningCount += 1
  }
  return { total, active: total - archivedCount, archived: archivedCount, running: runningCount }
}

/** 一张可拖拽的工作区卡片。 */
function WorkspaceCard({ workspace, selected, dragging, position, onCommit, onDragMove, onDragState, onOpen, onSelect, onContextMenu, zoom, toScene, sessionStats }: {
  workspace: WorkspaceView
  /** 是否选中（单击选中 → 蓝框）。 */
  selected: boolean
  dragging: boolean
  position: { x: number; y: number }
  onCommit: (id: WorkspaceId, position: { x: number; y: number }) => void
  onDragMove: (id: WorkspaceId, position: { x: number; y: number }) => void
  onDragState: (id: WorkspaceId, dragging: boolean) => void
  onOpen: (id: WorkspaceId) => void
  /** 单击选中（弹详情）。 */
  onSelect: (id: WorkspaceId) => void
  onContextMenu?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  /** 当前缩放（拖拽偏移换算 scene 坐标用）。 */
  zoom: number
  /** 屏幕坐标 → scene 坐标（P2 view 变换）。 */
  toScene: (clientX: number, clientY: number) => { x: number; y: number }
  /** 从同一份 sessions 快照计算的可见/归档会话统计。 */
  sessionStats: { total: number; active: number; archived: number; running: number }
}) {
  const dragRef = useRef<{ id: WorkspaceId; x0: number; y0: number; dx: number; dy: number; moved: boolean; position: { x: number; y: number } } | null>(null)
  const justDraggedRef = useRef(false)
  const activeCount = sessionStats.active
  const archivedCount = sessionStats.archived

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    dragRef.current = {
      id: workspace.workspaceId,
      x0: event.clientX,
      y0: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      moved: false,
      position,
    }
    onDragState(workspace.workspaceId, true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    if (!drag.moved && Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > DRAG_THRESHOLD) {
      drag.moved = true
    }
    if (!drag.moved) return
    // P2：视口带 view 变换，拖拽落点须换算回 scene 坐标（按下偏移按 zoom 缩放）。
    const scene = toScene(event.clientX, event.clientY)
    const nextPosition = {
      x: scene.x - drag.dx / zoom,
      y: scene.y - drag.dy / zoom,
    }
    drag.position = nextPosition
    // 拖动过程中只更新临时位置，不判断碰撞、不落盘。
    onDragMove(drag.id, nextPosition)
  }

  const onPointerUp = (): void => {
    const drag = dragRef.current
    justDraggedRef.current = drag?.moved ?? false
    if (drag?.moved === true) onCommit(drag.id, drag.position)
    if (drag !== null) onDragState(drag.id, false)
    dragRef.current = null
  }

  // 单击延迟 250ms 判双击（参考实现 同款）：单击 = 选中+详情；双击 = 进入新会话。
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onClick = (): void => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    if (clickTimer.current !== undefined) {
      // 250ms 内第二次点击 = 双击 → 进入新会话（取消单击的延迟选中）
      clearTimeout(clickTimer.current)
      clickTimer.current = undefined
      onOpen(workspace.workspaceId)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = undefined
      onSelect(workspace.workspaceId)
    }, 250)
  }
  const onDoubleClick = (): void => {
    // 双击：取消单击延迟选中，直接进入新会话
    if (clickTimer.current !== undefined) {
      clearTimeout(clickTimer.current)
      clickTimer.current = undefined
    }
    onOpen(workspace.workspaceId)
  }

  return (
    <button
      type="button"
      data-dsh-canvas-card={workspace.workspaceId}
      style={{
        ...CARD_STYLE,
        left: position.x,
        top: position.y,
        // 选中态：蓝色边框（单击选中；点空白取消）
        borderColor: selected ? 'var(--dsw-alias-state-business-primary)' : undefined,
        zIndex: selected || dragging ? 10 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={`${workspace.path}（${canvasText('canvas.sessions', { n: activeCount })}${archivedCount > 0 ? `，${archivedCount} 个已归档` : ''}）`}
    >
      <span style={CARD_TITLE_STYLE}>{workspace.title}</span>
      <span style={CARD_PATH_STYLE}>{workspace.path}</span>
      <span style={CARD_META_STYLE}>
        {canvasText('canvas.sessions', { n: activeCount })}
        {archivedCount > 0 ? ` · ${archivedCount} 归档` : ''}
      </span>
    </button>
  )
}

/** 中间区域画布：网格背景 + 全部工作区可拖拽卡片 + 工作区内的编排节点（分区渲染）。 */
export const CanvasView = memo(function CanvasView({ workspaces, store, onClose, ctx, registry }: CanvasViewProps) {
  // 官方 workspaces 标准 feed：ObservableSnapshot —— subscribe + getSnapshot
  // 直接喂给 useSyncExternalStore，工作区增删实时反映到画布。
  const list = workspaces.list
  const state: WorkspaceListState = useSyncExternalStore(
    (fn) => list.subscribe(fn),
    () => list.getSnapshot(),
  )
  // 工作区 feed 负责成员关系，sessions feed 负责 blank/running 等会话事实。
  // 订阅后，空白会话被创建/复用以及运行状态变化都会刷新画布统计。
  const sessionList = ctx?.sessions?.list
  useSyncExternalStore(
    sessionList !== undefined ? (fn) => sessionList.subscribe(fn) : EMPTY_SESSION_SUBSCRIBE,
    sessionList !== undefined ? () => sessionList.getSnapshot() : () => EMPTY_SESSION_STATE,
  )
  // 画布文档（编排节点数据源；布局持久化见 T015/T016）。
  const doc = useSyncExternalStore(
    (cb) => store.subscribe(() => cb()),
    () => store.read(),
  )
  // 初始布局来自文档（T016 恢复）；拖动时本地即时 + 落盘（T015）。
  const [positions, setPositions] = useState<Positions>(() => readWorkspacePositions(store))
  const [openError, setOpenError] = useState<string | undefined>()
  // 背景风格（004）：订阅持久化 id，缺省回退默认「网格」；背景层与交互状态解耦。
  const backgroundId = useSyncExternalStore(
    subscribeCanvasBackgroundId,
    () => getCanvasBackgroundId() ?? DEFAULT_BACKGROUND_ID,
  )
  const backgroundStyle = getCanvasBackgroundStyle(backgroundId)
  const [backgroundPanelOpen, setBackgroundPanelOpen] = useState<boolean>(false)

  const items = state.items ?? []
  const ready = state.baselinesReady || items.length > 0
  // feed 去重（防御）：同一 workspaceId 只渲染一张卡片（官方 feed 正常情况下唯一，
  // 但刷新/基线重放等路径可能出现重复项——重复会导致画布中一个工作区显示多张卡片）。
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>()
    const out: WorkspaceView[] = []
    for (const item of items) {
      const key = String(item.workspaceId)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }, [items])
  // 全局已归档会话集合（dsh 语义：归档保留在 sessionIds 账目，分组界面隐藏）。
  // 合并 feed archived + 本地乐观已归档集（005：归档后同步消失，不等 feed 推送）。
  const optimisticArchived = useSyncExternalStore(subscribeOptimisticArchived, getOptimisticArchived)
  const archivedSessionIds = useMemo(
    () => new Set([...(state.archivedSessionIds ?? []).map(String), ...optimisticArchived]),
    [state.archivedSessionIds, optimisticArchived],
  )
  const statsForWorkspace = (workspace: WorkspaceView) => workspaceSessionStats(workspace.sessionIds, archivedSessionIds, ctx)
  const orchestrationNodes = doc.nodes.filter((n) => n.kind !== 'workspace')
  // 有效位置表：已存档位置去重 + 完全重叠避让。
  // 修复：多个工作区曾同时补建为 (0,0)（旧版 syncWorkspaceNodes 写死原点）会在文档中
  // 留下相同坐标，导致卡片完全叠在一起、视觉上「少工作区」。此处对相同坐标只保留 feed
  // 顺序最靠前的那个，其余让位给 GRID 自动布局；无存档的走 autoPosition。
  // 语义：允许部分重叠（卡片可交叠一部分），仅禁止完全重叠（同点）。
  const effectivePositions = useMemo((): Positions => {
    const used = new Set<string>()
    const out: Positions = {}
    uniqueItems.forEach((workspace, index) => {
      const stored = positions[workspace.workspaceId]
      let pos: { x: number; y: number }
      if (stored !== undefined && !used.has(`${stored.x},${stored.y}`)) {
        pos = stored
      } else {
        // 无存档，或存档坐标与更早的工作区冲突 → 从 feed 顺序开始找第一个空 GRID 格。
        let i = index
        do {
          pos = autoPosition(i)
          i += 1
        } while (used.has(`${pos.x},${pos.y}`))
      }
      used.add(`${pos.x},${pos.y}`)
      out[workspace.workspaceId] = pos
    })
    return out
  }, [uniqueItems, positions])

  const commitPosition = (id: WorkspaceId, position: { x: number; y: number }): void => {
    // 拖拽落位防重叠：目标位置与其他卡片冲突时推挤到最近的空 GRID 格。
    // 覆盖「强行拖到一起」场景——即使有效位置表已避让，落盘值也必须不重叠。
    const others = uniqueItems
      .filter((w) => String(w.workspaceId) !== String(id))
      .map((w) => effectivePositions[w.workspaceId] ?? autoPosition(uniqueItems.findIndex((x) => x.workspaceId === w.workspaceId)))
      .filter((p): p is { x: number; y: number } => p !== undefined)
    const resolved = avoidOverlap(position, others)
    setPositions((prev) => ({ ...prev, [String(id)]: resolved }))
    commitWorkspacePosition(store, String(id), resolved)
  }

  const handleOpen = (id: WorkspaceId): void => {
    setOpenError(undefined)
    openWorkspaceSession(workspaces, id, (message) => {
      console.error(`[workspace-canvas] 进入会话失败：${message}`)
      setOpenError(message)
    }, () => onClose())
  }

  // 右键菜单与选中明细状态（T023-T027）。
  const [menu, setMenu] = useState<{ x: number; y: number; node: CanvasNode; view?: { sessionIds: ReadonlyArray<string>; title?: string; path?: string; archivedSessionIds?: ReadonlyArray<string> } } | undefined>()
  const [renameDialog, setRenameDialog] = useState<{ initial: string; resolve: (value: string | null) => void } | undefined>()
  const [confirmDialog, setConfirmDialog] = useState<{ request: ConfirmRequest; resolve: (ok: boolean) => void } | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [draggingId, setDraggingId] = useState<string | undefined>()

  const updateDragPosition = (id: WorkspaceId, position: { x: number; y: number }): void => {
    // 拖动预览只改内存位置，碰撞判断和持久化统一延迟到 pointerup。
    setPositions((prev) => ({ ...prev, [String(id)]: position }))
  }

  // ── P2 视图（缩放/平移/持久化）────────────────────────────────────────
  const areaRef = useRef<HTMLDivElement | null>(null)
  const wheelHandlerRef = useRef<((event: WheelEvent) => void) | null>(null)
  const [view, setView] = useState<ViewTransform>(() => store.read().view ?? defaultView())
  const viewRef = useRef(view)
  const viewTimer = useRef<ReturnType<typeof setTimeout> | undefined>()

  // 滚轮缩放（以鼠标为锚；原生监听 passive:false 才能 preventDefault）。
  // 画布区域是条件渲染（feed 就绪后出现），因此用回调 ref 在元素出现时再挂监听。
  useEffect(() => {
    const handler = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = areaRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const current = viewRef.current
      setView(zoomAt(
        current,
        current.zoom * wheelZoomFactor(event.deltaY),
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
      ))
    }
    wheelHandlerRef.current = handler
    if (areaRef.current !== null) {
      areaRef.current.addEventListener('wheel', handler, { passive: false })
    }
    return () => {
      if (areaRef.current !== null) areaRef.current.removeEventListener('wheel', handler)
      wheelHandlerRef.current = null
    }
  }, [])

  /** 画布区域回调 ref：元素出现/消失时维护滚轮监听。 */
  const setAreaRef = (el: HTMLDivElement | null): void => {
    if (areaRef.current !== null && wheelHandlerRef.current !== null) {
      areaRef.current.removeEventListener('wheel', wheelHandlerRef.current)
    }
    areaRef.current = el
    if (el !== null && wheelHandlerRef.current !== null) {
      el.addEventListener('wheel', wheelHandlerRef.current, { passive: false })
    }
  }

  // 屏幕坐标 → scene 坐标（未变换的区域层为坐标参考）。
  const toScene = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (rect === undefined) return { x: 0, y: 0 }
    return scenePoint(viewRef.current, { x: clientX - rect.left, y: clientY - rect.top })
  }

  useEffect(() => {
    viewRef.current = view
    if (viewTimer.current !== undefined) clearTimeout(viewTimer.current)
    // view 尾随防抖持久化到 CanvasDocument.view（store 写入自身再防抖，双层兜底）。
    viewTimer.current = setTimeout(() => {
      viewTimer.current = undefined
      store.mutate((doc) => { doc.view = viewRef.current })
    }, 400)
    return () => {
      if (viewTimer.current !== undefined) clearTimeout(viewTimer.current)
    }
  }, [view, store])

  // 空白拖拽平移（卡片/成员上的按下不触发）。
  const panRef = useRef<{ startX: number; startY: number; view: ViewTransform } | null>(null)
  // 空白平移拖拽中：光标 grabbing（悬停 grab）
  const [panning, setPanning] = useState(false)
  const onAreaPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    // 卡片/成员/详情面板（含宽度调节手柄）上的按下不触发空白平移与取消选中
    if (target.closest('[data-dsh-canvas-card], [data-dsh-canvas-member], [data-dsh-canvas-detail]') !== null) return
    if (event.button !== 0) return
    // 点画布空白 → 取消工作区/节点选中（明细收起）+ 进入平移拖拽（手型握紧）
    setSelectedId(undefined)
    setPanning(true)
    panRef.current = { startX: event.clientX, startY: event.clientY, view: viewRef.current }
  }
  const onAreaPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current
    if (pan === null) return
    setView(panBy(pan.view, event.clientX - pan.startX, event.clientY - pan.startY))
  }
  const onAreaPointerUp = (): void => {
    panRef.current = null
    setPanning(false)
  }

  // 操作栏：以区域中心为锚缩放 / 重置视图。
  const zoomBy = (factor: number): void => {
    const rect = areaRef.current?.getBoundingClientRect()
    const center = rect !== undefined ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
    const current = viewRef.current
    setView(zoomAt(current, current.zoom * factor, center))
  }
  // 重置视图：缩放回 1，并平移使工作区集群包围盒中心位于视口中心（大多数工作区居中）。
  const resetViewTransform = (): void => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (rect === undefined || items.length === 0) {
      setView(resetView())
      return
    }
    // 集群包围盒（scene 像素；卡片尺寸约 200×80）
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    items.forEach((w, index) => {
      const pos = effectivePositions[w.workspaceId] ?? autoPosition(index)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + 200)
      maxY = Math.max(maxY, pos.y + 80)
    })
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setView({ x: rect.width / 2 - cx, y: rect.height / 2 - cy, zoom: 1 })
  }

  // 刷新（参考实现 RefreshCw）：重新拉取工作区基线；feed 更新后画布自动重渲染。
  // IWorkspaces 接口未暴露 refresh（Wire-pump 入口在具体类），运行时可选链兜底，
  // 失败/缺失安全降级（不报错、保持原数据）。
  const handleRefresh = (): void => {
    const workspaces = ctx?.workspaces as { refresh?: () => Promise<void> } | undefined
    void workspaces?.refresh?.()
    // 005 自动归档：画布刷新时执行一次归档判断（页面加载那次由 runtime 负责）
    if (ctx !== undefined) {
      void runAutoArchive(ctx, items, archivedSessionIds).catch((err) => {
        console.error('[workspace-canvas] 自动归档执行失败：', err)
      })
    }
  }

  const openMenu = (
    event: { clientX: number; clientY: number; preventDefault(): void },
    node: CanvasNode,
    view?: { sessionIds: ReadonlyArray<string>; title?: string; path?: string; archivedSessionIds?: ReadonlyArray<string> },
  ): void => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, node, view })
  }

  const menuItems = (): MenuItem[] => {
    if (menu === undefined || ctx === undefined) return []
    const actions = menu.node.kind === 'workspace'
      ? [
        ...workspaceActions({
          ctx,
          store,
          doc,
          view: menu.view,
          onRequestDetail: (id) => setSelectedId(`ws:${id}`),
          onNotify: (m) => setOpenError(m),
          confirm: (request) => new Promise<boolean>((resolve) => {
            setConfirmDialog({ request, resolve })
          }),
          prompt: async (_message, initial) => new Promise<string | null>((resolve) => {
            setRenameDialog({ initial: initial ?? '', resolve })
          }),
        }),
        ...(registry?.mergeActions('workspace') ?? []),
      ]
      : (registry?.mergeActions(menu.node.kind) ?? [])
    return actions.map((a) => ({
      id: a.id,
      label: a.label.zh,
      danger: a.id === 'delete',
      icon: MENU_ITEM_ICONS[a.id],
      run: () => { void a.run(menu.node, doc) },
    }))
  }

  const renderMember = (member: (typeof doc.nodes)[number], workspacePosition: { x: number; y: number }) => {
    const type = registry?.getNodeType(member.kind)
    const instance = type !== undefined && ctx !== undefined
      ? type.data.list(ctx).getSnapshot().find((i) => i.id === member.ref)
      : undefined
    const abs = partitionPosition(workspacePosition, member.position)
    return (
      <div
        key={member.id}
        data-dsh-canvas-member={member.id}
        style={{ position: 'absolute', left: abs.x, top: abs.y, zIndex: 2 }}
        onContextMenu={(event) => openMenu(event, member)}
      >
        {type !== undefined
          ? <type.render node={member} instance={instance} selected={selectedId === member.id} dragging={false} onSelect={() => setSelectedId(member.id)} onOpen={() => setSelectedId(member.id)} />
          : (
            <span style={{ background: 'var(--dsw-alias-bg-layer-1)', border: '1px dashed var(--dsw-alias-border-l2)', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
              {member.kind}（未知类型）
            </span>
          )}
      </div>
    )
  }

  return (
    <div style={WRAPPER_STYLE}>
      <div style={HEADER_STYLE}>
        <div>
          <div style={TITLE_STYLE}>{canvasText('canvas.title')}</div>
          <div style={SUBTITLE_STYLE}>{canvasText('canvas.subtitle')}</div>
        </div>
        <button type="button" style={CLOSE_STYLE} onClick={onClose}>
          {canvasText('canvas.close')}
        </button>
      </div>
      {openError !== undefined && (
        <div role="alert" style={{ ...EMPTY_STYLE, color: 'var(--dsw-alias-state-error-primary)' }}>
          {canvasText('canvas.openError', { message: openError })}
        </div>
      )}
      {!ready
        ? <div style={EMPTY_STYLE}>{canvasText('canvas.loading')}</div>
        : uniqueItems.length === 0
          ? <div style={EMPTY_STYLE}>{canvasText('canvas.empty')}</div>
          : (
            <div
              ref={setAreaRef}
              style={{ ...CANVAS_STYLE, cursor: panning ? 'grabbing' : 'grab' }}
              onPointerDown={onAreaPointerDown}
              onPointerMove={onAreaPointerMove}
              onPointerUp={onAreaPointerUp}
              onPointerLeave={onAreaPointerUp}
              // 空白区域右键：阻止浏览器原生菜单（偏白无角长方形），保持画布内菜单一致性
              onContextMenu={(event) => event.preventDefault()}
              data-dsh-canvas-area=""
            >
              {/* 背景层（按当前风格渲染）：图案类取模跟随平移（永不露白），铺满类固定；
                  不随缩放变化；与节点层解耦，切换风格不重置交互状态 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 0,
                  backgroundColor: backgroundStyle.backgroundColor,
                  backgroundImage: backgroundStyle.backgroundImage,
                  backgroundSize: backgroundStyle.backgroundSize,
                  backgroundRepeat: 'repeat',
                  backgroundPosition: backgroundStyle.followPan ? `${view.x % GRID}px ${view.y % GRID}px` : '0 0',
                }}
                data-dsh-canvas-bg={backgroundStyle.id}
              />
              {/* 节点层：缩放/平移只作用于本层 */}
              <div
                style={{
                  ...NODE_LAYER_STYLE,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                }}
                data-dsh-canvas-viewport=""
              >
                {uniqueItems.map((workspace, index) => {
                  const workspacePosition = effectivePositions[workspace.workspaceId] ?? autoPosition(index)
                  const members = orchestrationNodes.filter((n) => n.workspaceId === workspace.workspaceId)
                  const workspaceNode: CanvasNode = {
                    id: `ws:${String(workspace.workspaceId)}`,
                    kind: 'workspace',
                    ref: String(workspace.workspaceId),
                    position: workspacePosition,
                  }
                  return (
                    <Fragment key={workspace.workspaceId}>
                      <WorkspaceCard
                        workspace={workspace}
                        selected={selectedId === `ws:${String(workspace.workspaceId)}`}
                        dragging={draggingId === String(workspace.workspaceId)}
                        position={workspacePosition}
                        onCommit={commitPosition}
                        onDragMove={updateDragPosition}
                        onDragState={(id, active) => setDraggingId(active ? String(id) : undefined)}
                        onOpen={handleOpen}
                        onSelect={(id) => setSelectedId(`ws:${String(id)}`)}
                        onContextMenu={(event) => openMenu(event, workspaceNode, { sessionIds: workspace.sessionIds, title: workspace.title, path: workspace.path, archivedSessionIds: [...archivedSessionIds] })}
                        zoom={view.zoom}
                        toScene={toScene}
                        sessionStats={statsForWorkspace(workspace)}
                      />
                      {members.map((member) => renderMember(member, workspacePosition))}
                    </Fragment>
                  )
                })}
              </div>
              {/* 底部操作栏（系统 Button toolbar 变体，结构/圆角/hover 背景系统保证）：
                  缩小 → 重置 → 放大 → 刷新 → 背景风格（纯图标按钮） */}
              <style>{ACTION_BAR_HOVER_CSS}</style>
              <div style={ACTION_BAR_STYLE} data-dsh-action-bar="">
                <Button variant="toolbar" size="sm" data-dsh-action-zoom-out onClick={() => zoomBy(0.9)} aria-label="缩小" title="缩小"><IconZoomOut /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-reset onClick={resetViewTransform} aria-label="重置视图" title="重置视图"><IconLocateFixed /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-zoom-in onClick={() => zoomBy(1.1)} aria-label="放大" title="放大"><IconZoomIn /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-refresh onClick={handleRefresh} aria-label="刷新" title="刷新"><IconRefreshAction /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-background onClick={() => setBackgroundPanelOpen((open) => !open)} aria-label="背景风格" title="背景风格"><IconPersonalizationOutline16 /></Button>
                {backgroundPanelOpen && (
                  <div style={BACKGROUND_PANEL_STYLE} data-dsh-background-panel="">
                    {CANVAS_BACKGROUND_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        data-dsh-background-option={style.id}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setBackgroundPanelOpen(false)
                          setCanvasBackgroundId(style.id)
                        }}
                        style={{
                          ...BACKGROUND_OPTION_STYLE,
                          color: style.id === backgroundId ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-label-secondary)',
                        }}
                      >
                        <span style={{ flex: 1, textAlign: 'left' }}>
                          <span style={{ display: 'block', fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>{style.name}</span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>{style.description}</span>
                        </span>
                        {style.id === backgroundId ? <IconCheckOutline16 /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 右侧详情框：渲染在画布区域内（顶部在顶部栏之下，不覆盖 header） */}
              {selectedId !== undefined && ctx !== undefined && (() => {
                const selectedNode = doc.nodes.find((n) => n.id === selectedId)
                if (selectedNode === undefined) return null
                if (selectedNode.kind === 'workspace') {
                  const wsView = items.find((w) => String(w.workspaceId) === selectedNode.ref)
                  if (wsView === undefined) return null
                  return (
                    <DetailPanel
                      node={selectedNode}
                      doc={doc}
                      sections={registry?.mergeSections('workspace') ?? []}
                      title={workspaceDisplayTitle(wsView.title, wsView.path)}
                      onClose={() => setSelectedId(undefined)}
                      ownerDetail={() => (
                        <WorkspaceDetail
                          view={{ title: wsView.title, path: wsView.path, sessionIds: wsView.sessionIds, workspaceId: String(wsView.workspaceId) }}
                          recent={wsView.workspaceId === state.recentWorkspaceId}
                          sessionStats={statsForWorkspace(wsView)}
                        />
                      )}
                    />
                  )
                }
                const type = registry?.getNodeType(selectedNode.kind)
                const instance = type?.data.list(ctx).getSnapshot().find((i) => i.id === selectedNode.ref)
                return (
                  <DetailPanel
                    node={selectedNode}
                    instance={instance}
                    doc={doc}
                    ownerDetail={type?.detail}
                    sections={registry?.mergeSections(selectedNode.kind) ?? []}
                    onClose={() => setSelectedId(undefined)}
                  />
                )
              })()}
            </div>
          )}
      {menu !== undefined && ctx !== undefined && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(undefined)} />
      )}
      {renameDialog !== undefined && (
        <RenameDialog
          initial={renameDialog.initial}
          onResolve={(value) => {
            const resolve = renameDialog.resolve
            setRenameDialog(undefined)
            resolve(value)
          }}
        />
      )}
      {confirmDialog !== undefined && (
        <ConfirmDialog
          request={confirmDialog.request}
          onResolve={(ok) => {
            const resolve = confirmDialog.resolve
            setConfirmDialog(undefined)
            resolve(ok)
          }}
        />
      )}
    </div>
  )
})
