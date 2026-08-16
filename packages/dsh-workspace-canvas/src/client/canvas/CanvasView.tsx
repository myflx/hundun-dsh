import { Fragment, memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { IWorkspaces, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-connection/client'
import type { CanvasDocumentStore, CanvasNode } from './document.ts'
import type { CanvasRegistryImpl } from './registry.ts'
import { ContextMenu, type MenuItem } from './menu.ts'
import { workspaceActions } from './workspace-actions.ts'
import { DetailPanel } from './detail/panel.tsx'
import { WorkspaceDetail } from './detail/workspace-detail.tsx'
import { openWorkspaceSession } from './workspace-open.ts'
import { commitWorkspacePosition, readWorkspacePositions, autoLayoutWorkspaces } from './workspace-position.ts'
import { defaultView, focusView, panBy, resetView, scenePoint, wheelZoomFactor, zoomAt, type ViewTransform } from './view-transform.ts'
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

/** 画布底部操作栏（Canvas Action Bar）：缩放控件 + 重置视图 + 自动布局 + 聚焦。
 *  复用系统设计令牌（--dsw-alias-*），与系统控件视觉一致；低干扰浮层。 */
const ACTION_BAR_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 70,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  background: 'var(--dsw-alias-surface-raised)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  fontSize: 12,
  whiteSpace: 'nowrap',
} as const

/** 操作栏分隔线。 */
const BAR_DIVIDER_STYLE: CSSProperties = {
  width: 1,
  height: 16,
  margin: '0 4px',
  background: 'var(--dsw-alias-border-l2)',
} as const

/** 聚焦目标选择弹层（操作栏上方）。 */
const FOCUS_MENU_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 40,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 75,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 160,
  maxHeight: 240,
  overflowY: 'auto',
  padding: 4,
  background: 'var(--dsw-alias-surface-raised)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  fontSize: 12,
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

function toolButtonDisabled(): CSSProperties {
  return { opacity: 0.4, cursor: 'default' }
}

const CARD_STYLE: CSSProperties = {
  background: 'var(--dsw-alias-surface-raised)',
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
function WorkspaceCard({ workspace, recent, position, onCommit, onOpen, onContextMenu, zoom, toScene }: {
  workspace: WorkspaceView
  recent: boolean
  position: { x: number; y: number }
  onCommit: (id: WorkspaceId, position: { x: number; y: number }) => void
  onOpen: (id: WorkspaceId) => void
  onContextMenu?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  /** 当前缩放（拖拽偏移换算 scene 坐标用）。 */
  zoom: number
  /** 屏幕坐标 → scene 坐标（P2 view 变换）。 */
  toScene: (clientX: number, clientY: number) => { x: number; y: number }
}) {
  const dragRef = useRef<{ id: WorkspaceId; x0: number; y0: number; dx: number; dy: number; moved: boolean } | null>(null)
  const justDraggedRef = useRef(false)

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

  const onClick = (): void => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    // 未拖动 = 点击进入该工作区的新会话。
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
        borderColor: recent ? 'var(--dsw-alias-state-business-primary)' : undefined,
        zIndex: 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${workspace.path}（${canvasText('canvas.sessions', { n: workspace.sessionIds.length })}）`}
    >
      <span style={CARD_TITLE_STYLE}>{workspace.title}</span>
      <span style={CARD_PATH_STYLE}>{workspace.path}</span>
      <span style={CARD_META_STYLE}>{canvasText('canvas.sessions', { n: workspace.sessionIds.length })}</span>
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
  const onAreaPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement
    if (target.closest('[data-dsh-canvas-card], [data-dsh-canvas-member]') !== null) return
    if (event.button !== 0) return
    panRef.current = { startX: event.clientX, startY: event.clientY, view: viewRef.current }
  }
  const onAreaPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panRef.current
    if (pan === null) return
    setView(panBy(pan.view, event.clientX - pan.startX, event.clientY - pan.startY))
  }
  const onAreaPointerUp = (): void => { panRef.current = null }

  // 操作栏：以区域中心为锚缩放 / 重置视图。
  const zoomBy = (factor: number): void => {
    const rect = areaRef.current?.getBoundingClientRect()
    const center = rect !== undefined ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
    const current = viewRef.current
    setView(zoomAt(current, current.zoom * factor, center))
  }
  const resetViewTransform = (): void => setView(resetView())

  // 自动布局（US2）：按 feed 顺序 GRID 重排全部工作区，本地 state 同步 + 持久化。
  const handleAutoLayout = (): void => {
    const ids = items.map((w) => String(w.workspaceId))
    if (ids.length === 0) return
    autoLayoutWorkspaces(store, ids)
    setPositions(readWorkspacePositions(store))
  }

  // 聚焦工作区（US3）：选择目标 → focusView 平移居中（zoom 不变）；目标缺失时不动视图。
  const [focusOpen, setFocusOpen] = useState(false)
  const handleFocus = (workspaceId: string): void => {
    setFocusOpen(false)
    const target = items.find((w) => String(w.workspaceId) === workspaceId)
    const rect = areaRef.current?.getBoundingClientRect()
    if (target === undefined || rect === undefined) return
    const pos = positions[workspaceId] ?? autoPosition(items.indexOf(target))
    // 卡片中心 scene 坐标（卡宽 200、高约 80）
    const center = { x: pos.x + 100, y: pos.y + 40 }
    setView(focusView(viewRef.current, center, { w: rect.width, h: rect.height }))
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
            <span style={{ background: 'var(--dsw-alias-surface-raised, #fff)', border: '1px dashed var(--dsw-alias-border-l2, #ccc)', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
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
        <div role="alert" style={{ ...EMPTY_STYLE, color: 'var(--dsw-alias-state-danger, #d64545)' }}>
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
              style={CANVAS_STYLE}
              onPointerDown={onAreaPointerDown}
              onPointerMove={onAreaPointerMove}
              onPointerUp={onAreaPointerUp}
              onPointerLeave={onAreaPointerUp}
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
                        recent={workspace.workspaceId === state.recentWorkspaceId}
                        position={workspacePosition}
                        onCommit={commitPosition}
                        onOpen={handleOpen}
                        onContextMenu={(event) => openMenu(event, workspaceNode, { sessionIds: workspace.sessionIds })}
                        zoom={view.zoom}
                        toScene={toScene}
                      />
                      {members.map((member) => renderMember(member, workspacePosition))}
                    </Fragment>
                  )
                })}
              </div>
              {/* 底部操作栏：缩放 + 重置视图 + 自动布局 + 聚焦（US1/US2/US3） */}
              <div style={ACTION_BAR_STYLE} data-dsh-action-bar="">
                <button type="button" style={toolButton('')} data-dsh-action-zoom-out onClick={() => zoomBy(0.9)} aria-label="缩小">−</button>
                <span data-dsh-action-zoom-percent style={{ minWidth: 44, textAlign: 'center' }}>{Math.round(view.zoom * 100)}%</span>
                <button type="button" style={toolButton('')} data-dsh-action-zoom-in onClick={() => zoomBy(1.1)} aria-label="放大">+</button>
                <button type="button" style={toolButton('')} data-dsh-action-reset onClick={resetViewTransform} aria-label="重置视图">重置视图</button>
                <span style={BAR_DIVIDER_STYLE} />
                <button
                  type="button"
                  style={items.length === 0 ? { ...toolButton(''), ...toolButtonDisabled() } : toolButton('')}
                  data-dsh-action-layout
                  disabled={items.length === 0}
                  onClick={handleAutoLayout}
                  aria-label="自动布局"
                >自动布局</button>
                <button
                  type="button"
                  style={items.length === 0 ? { ...toolButton(''), ...toolButtonDisabled() } : toolButton('')}
                  data-dsh-action-focus
                  disabled={items.length === 0}
                  onClick={() => setFocusOpen((v) => !v)}
                  aria-label="聚焦工作区"
                >聚焦</button>
                {focusOpen && items.length > 0 && (
                  <div style={FOCUS_MENU_STYLE} data-dsh-action-focus-menu="">
                    {items.map((w) => (
                      <button
                        key={w.workspaceId}
                        type="button"
                        style={{ ...toolButton(''), textAlign: 'left' }}
                        onClick={() => handleFocus(String(w.workspaceId))}
                      >
                        {w.title}
                      </button>
                    ))}
                  </div>
                )}
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
