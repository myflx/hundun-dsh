import { Fragment, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IWorkspaces, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-connection/client'
// 系统组件/图标（primitives 在客户端平台表；操作栏用系统 Button toolbar 变体，颜色交互系统保证）
import { Button, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CanvasDocumentStore, CanvasNode } from './document.ts'
import type { CanvasRegistryImpl } from './registry.ts'
import { ContextMenu, MENU_ITEM_ICONS, type MenuItem } from './menu.ts'
import { workspaceActions } from './workspace-actions.ts'
import { DetailPanel } from './detail/panel.tsx'
import { WorkspaceDetail } from './detail/workspace-detail.tsx'
import { openWorkspaceSession } from './workspace-open.ts'
import { commitWorkspacePosition, readWorkspacePositions } from './workspace-position.ts'
import { defaultView, panBy, resetView, scenePoint, wheelZoomFactor, zoomAt, type ViewTransform } from './view-transform.ts'
import { canvasText } from './text.ts'

/** 画布 props：官方 workspaces feed + 文档存储（布局持久化）+ 关闭回调。
 *  ctx/registry 可选（分区渲染编排节点需要；缺省时只渲染工作区卡片，便于隔离测试）。 */
export interface CanvasViewProps {
  workspaces: IWorkspaces
  store: CanvasDocumentStore
  onClose: () => void
  ctx?: ClientContext
  registry?: CanvasRegistryImpl
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

/** 网格层（无限画布底）：铺满区域，网格尺寸固定，不随缩放变化；
 *  平移时以 background-position 取模跟随（周期 = 格距），永不露白，制造无限大观感。 */
const GRID_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: [
    'linear-gradient(var(--dsw-alias-border-l2) 1px, transparent 1px)',
    'linear-gradient(90deg, var(--dsw-alias-border-l2) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: `${GRID}px ${GRID}px`,
  zIndex: 0,
} as const

/** 节点层：全部卡片/成员，经 view 变换（translate + scale，原点 0 0）。
 *  缩放只作用于本层——网格底保持不变，仅节点随 zoom 放大/缩小。 */
const NODE_LAYER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  transformOrigin: '0 0',
  zIndex: 1,
} as const

/** 画布底部操作栏（对齐 hundun-web canvas-controls）：四图标按钮（缩小/重置/放大/刷新）。
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

/** ── 操作栏按钮颜色（系统 Button toolbar 结构/圆角/hover 背景系统保证；
 *   颜色覆盖为用户要求的默认灰 → hover 白；特异性高于 Button class 规则） ── */
const ACTION_BAR_HOVER_CSS = `
[data-dsh-action-bar] button { color: var(--dsw-alias-label-tertiary); }
[data-dsh-action-bar] button:hover { color: var(--dsw-alias-label-primary); }
`

/** ── 操作栏图标（内联 SVG，lucide 同款 path，ISC 开源；颜色走 currentColor = 系统令牌） ── */

/** 缩小（hundun-web ZoomOut）：放大镜 + 减号。 */
function IconZoomOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

/** 重置（hundun-web LocateFixed）：十字准星 + 中心点。 */
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

/** 放大（hundun-web ZoomIn）：放大镜 + 加号。 */
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

/** 一张可拖拽的工作区卡片。 */
function WorkspaceCard({ workspace, selected, position, onCommit, onOpen, onSelect, onContextMenu, zoom, toScene, archivedSessionIds }: {
  workspace: WorkspaceView
  /** 是否选中（单击选中 → 蓝框）。 */
  selected: boolean
  position: { x: number; y: number }
  onCommit: (id: WorkspaceId, position: { x: number; y: number }) => void
  onOpen: (id: WorkspaceId) => void
  /** 单击选中（弹详情）。 */
  onSelect: (id: WorkspaceId) => void
  onContextMenu?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  /** 当前缩放（拖拽偏移换算 scene 坐标用）。 */
  zoom: number
  /** 屏幕坐标 → scene 坐标（P2 view 变换）。 */
  toScene: (clientX: number, clientY: number) => { x: number; y: number }
  /** 全局已归档会话集合（分组界面隐藏；卡片计数按未归档显示）。 */
  archivedSessionIds?: ReadonlySet<string>
}) {
  const dragRef = useRef<{ id: WorkspaceId; x0: number; y0: number; dx: number; dy: number; moved: boolean } | null>(null)
  const justDraggedRef = useRef(false)
  // 未归档会话数（dsh 语义：归档保留在 sessionIds 账目，分组界面隐藏——卡片计数与侧边栏一致）
  const activeCount = workspace.sessionIds.filter((id) => !archivedSessionIds?.has(String(id))).length
  const totalCount = workspace.sessionIds.length

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      id: workspace.workspaceId,
      x0: event.clientX,
      y0: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      moved: false,
    }
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
    onCommit(drag.id, {
      x: scene.x - drag.dx / zoom,
      y: scene.y - drag.dy / zoom,
    })
  }

  const onPointerUp = (): void => {
    justDraggedRef.current = dragRef.current?.moved ?? false
    dragRef.current = null
  }

  // 单击延迟 250ms 判双击（hundun-web 同款）：单击 = 选中+详情；双击 = 进入新会话。
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
        zIndex: selected ? 2 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={`${workspace.path}（${canvasText('canvas.sessions', { n: activeCount })}${totalCount > activeCount ? `，${totalCount - activeCount} 个已归档` : ''}）`}
    >
      <span style={CARD_TITLE_STYLE}>{workspace.title}</span>
      <span style={CARD_PATH_STYLE}>{workspace.path}</span>
      <span style={CARD_META_STYLE}>
        {canvasText('canvas.sessions', { n: activeCount })}
        {totalCount > activeCount ? ` · ${totalCount - activeCount} 归档` : ''}
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
  // 画布文档（编排节点数据源；布局持久化见 T015/T016）。
  const doc = useSyncExternalStore(
    (cb) => store.subscribe(() => cb()),
    () => store.read(),
  )
  // 初始布局来自文档（T016 恢复）；拖动时本地即时 + 落盘（T015）。
  const [positions, setPositions] = useState<Positions>(() => readWorkspacePositions(store))
  const [openError, setOpenError] = useState<string | undefined>()

  const items = state.items ?? []
  const ready = state.baselinesReady || items.length > 0
  // 全局已归档会话集合（dsh 语义：归档保留在 sessionIds 账目，分组界面隐藏）
  const archivedSessionIds = useMemo(() => new Set((state.archivedSessionIds ?? []).map(String)), [state.archivedSessionIds])
  const orchestrationNodes = doc.nodes.filter((n) => n.kind !== 'workspace')

  const commitPosition = (id: WorkspaceId, position: { x: number; y: number }): void => {
    setPositions((prev) => ({ ...prev, [String(id)]: position }))
    commitWorkspacePosition(store, String(id), position)
  }

  const handleOpen = (id: WorkspaceId): void => {
    setOpenError(undefined)
    openWorkspaceSession(workspaces, id, (message) => {
      console.error(`[workspace-canvas] 进入会话失败：${message}`)
      setOpenError(message)
    }, () => onClose())
  }

  // 右键菜单与选中明细状态（T023-T027）。
  const [menu, setMenu] = useState<{ x: number; y: number; node: CanvasNode; view?: { sessionIds: ReadonlyArray<string> } } | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()

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
    if (target.closest('[data-dsh-canvas-card], [data-dsh-canvas-member]') !== null) return
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
      const pos = positions[w.workspaceId] ?? autoPosition(index)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + 200)
      maxY = Math.max(maxY, pos.y + 80)
    })
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setView({ x: rect.width / 2 - cx, y: rect.height / 2 - cy, zoom: 1 })
  }

  // 刷新（hundun-web RefreshCw）：重新拉取工作区基线；feed 更新后画布自动重渲染。
  // IWorkspaces 接口未暴露 refresh（Wire-pump 入口在具体类），运行时可选链兜底，
  // 失败/缺失安全降级（不报错、保持原数据）。
  const handleRefresh = (): void => {
    const workspaces = ctx?.workspaces as { refresh?: () => Promise<void> } | undefined
    void workspaces?.refresh?.()
  }

  const openMenu = (
    event: { clientX: number; clientY: number; preventDefault(): void },
    node: CanvasNode,
    view?: { sessionIds: ReadonlyArray<string> },
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
          <div style={SUBTITLE_STYLE}>{canvasText('canvas.subtitle')} <span data-dsh-canvas-version="" style={{ opacity: 0.55 }}>v3.2</span></div>
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
        : items.length === 0
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
              {/* 无限网格底：固定格距，background-position 取模跟随平移（永不露白）；不随缩放变化 */}
              <div
                style={{
                  ...GRID_STYLE,
                  backgroundPosition: `${view.x % GRID}px ${view.y % GRID}px`,
                }}
                data-dsh-canvas-grid=""
              />
              {/* 节点层：缩放/平移只作用于本层 */}
              <div
                style={{
                  ...NODE_LAYER_STYLE,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                }}
                data-dsh-canvas-viewport=""
              >
                {items.map((workspace, index) => {
                  const workspacePosition = positions[workspace.workspaceId] ?? autoPosition(index)
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
                        position={workspacePosition}
                        onCommit={commitPosition}
                        onOpen={handleOpen}
                        onSelect={(id) => setSelectedId(`ws:${String(id)}`)}
                        onContextMenu={(event) => openMenu(event, workspaceNode, { sessionIds: workspace.sessionIds })}
                        zoom={view.zoom}
                        toScene={toScene}
                        archivedSessionIds={archivedSessionIds}
                      />
                      {members.map((member) => renderMember(member, workspacePosition))}
                    </Fragment>
                  )
                })}
              </div>
              {/* 底部操作栏（系统 Button toolbar 变体，结构/圆角/hover 背景系统保证）：
                  缩小 → 重置 → 放大 → 刷新（纯图标按钮） */}
              <style>{ACTION_BAR_HOVER_CSS}</style>
              <div style={ACTION_BAR_STYLE} data-dsh-action-bar="">
                <Button variant="toolbar" size="sm" data-dsh-action-zoom-out onClick={() => zoomBy(0.9)} aria-label="缩小" title="缩小"><IconZoomOut /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-reset onClick={resetViewTransform} aria-label="重置视图" title="重置视图"><IconLocateFixed /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-zoom-in onClick={() => zoomBy(1.1)} aria-label="放大" title="放大"><IconZoomIn /></Button>
                <Button variant="toolbar" size="sm" data-dsh-action-refresh onClick={handleRefresh} aria-label="刷新" title="刷新"><IconRefreshAction /></Button>
              </div>
            </div>
          )}
      {menu !== undefined && ctx !== undefined && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(undefined)} />
      )}
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
              onClose={() => setSelectedId(undefined)}
              ownerDetail={() => (
                <WorkspaceDetail
                  view={{ title: wsView.title, path: wsView.path, sessionIds: wsView.sessionIds }}
                  recent={wsView.workspaceId === state.recentWorkspaceId}
                  onJumpSidebar={() => { setSelectedId(undefined); onClose() }}
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
  )
})
