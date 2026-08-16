import { Fragment, memo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
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
import { commitWorkspacePosition, readWorkspacePositions } from './workspace-position.ts'
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

/** 画布区域：铺满中间区域剩余空间，相对定位 + 网格背景（十字线）。 */
const CANVAS_STYLE: CSSProperties = {
  backgroundImage: [
    'linear-gradient(var(--dsw-alias-border-l2) 1px, transparent 1px)',
    'linear-gradient(90deg, var(--dsw-alias-border-l2) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: `${GRID}px ${GRID}px`,
  flex: 1,
  minHeight: '240px',
  overflow: 'auto',
  position: 'relative',
} as const

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
function WorkspaceCard({ workspace, recent, position, onCommit, onOpen, onContextMenu }: {
  workspace: WorkspaceView
  recent: boolean
  position: { x: number; y: number }
  onCommit: (id: WorkspaceId, position: { x: number; y: number }) => void
  onOpen: (id: WorkspaceId) => void
  onContextMenu?: (event: ReactPointerEvent<HTMLButtonElement>) => void
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
    const canvas = event.currentTarget.parentElement
    if (canvas === null) return
    const rect = canvas.getBoundingClientRect()
    onCommit(drag.id, {
      x: event.clientX - rect.left - drag.dx,
      y: event.clientY - rect.top - drag.dy,
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
    })
  }

  // 右键菜单与选中明细状态（T023-T027）。
  const [menu, setMenu] = useState<{ x: number; y: number; node: CanvasNode; view?: { sessionIds: ReadonlyArray<string> } } | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()

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
            <div style={CANVAS_STYLE}>
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
                    />
                    {members.map((member) => renderMember(member, workspacePosition))}
                  </Fragment>
                )
              })}
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
