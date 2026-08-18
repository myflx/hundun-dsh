/**
 * 工作区内置右键动作（T024）。
 *
 * 进入 / 详情 / 重命名 / 全部归档 / 删除（级联确认）。
 * - 删除：确认（列出将删除的成员数）→ 级联清理画布成员 → 官方 workspaces.delete；
 * - 重命名 / 归档 / 进入走官方 API；
 * - confirm/prompt 可注入（测试用），缺省 window 实现。
 * - confirm 请求结构化（ConfirmRequest）：宿主渲染 DSH 系统弹窗（Modal），
 *   文案与按钮由动作定义，与官方删除确认同款。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CanvasDocument, CanvasDocumentStore, CanvasNode } from './document.ts'
import type { NodeAction } from './registry.ts'
import { removeWorkspaceCascade } from './workspace-nodes.ts'
import { workspaceDisplayTitle } from './detail/workspace-title.ts'

/** 二次确认请求：宿主据此渲染 DSH 系统弹窗（Modal：标题 + 描述 + 取消/确认）。 */
export interface ConfirmRequest {
  /** 弹窗标题。 */
  title: string
  /** 弹窗描述（正文文案）。 */
  description: string
  /** 确认按钮文案。 */
  confirmLabel: string
  /** 危险操作（确认按钮用系统错误色，如删除）。 */
  danger?: boolean
}

export interface WorkspaceActionContext {
  ctx: ClientContext
  store: CanvasDocumentStore
  doc: CanvasDocument
  /** 工作区实例（feed 投影，供归档会话取 sessionIds/已归档集合、重命名取展示名）。 */
  view?: {
    sessionIds: ReadonlyArray<string>
    title?: string
    path?: string
    /** 已归档会话 id 集合（feed archived + 本地乐观标记），供「未归档会话数」计数。 */
    archivedSessionIds?: ReadonlyArray<string>
  }
  onRequestDetail?(workspaceId: string): void
  onNotify?(message: string): void
  confirm?(request: ConfirmRequest): boolean | Promise<boolean>
  prompt?(message: string, initial?: string): string | null | Promise<string | null>
}

/**
 * 重命名弹窗的初始值：工作区展示名（自定义标题 → 目录名 → 兜底占位）。
 * 不显示工作区 ID（ref）。仅在无 feed 视图信息（测试/异常路径）时退回
 * node.label ?? ref。
 */
function renameInitialValue(ac: WorkspaceActionContext, node: CanvasNode): string {
  const view = ac.view
  if (view !== undefined) return workspaceDisplayTitle(view.title ?? '', view.path ?? '')
  return node.label ?? node.ref
}

function nativeConfirm(request: ConfirmRequest): boolean {
  return typeof window !== 'undefined' ? window.confirm(request.description) : false
}

function nativePrompt(message: string): string | null {
  return typeof window !== 'undefined' ? window.prompt(message) : null
}

/** 工作区内置动作列表（画布固有，kind='workspace' 的默认菜单）。 */
export function workspaceActions(ac: WorkspaceActionContext): NodeAction[] {
  const confirm = ac.confirm ?? nativeConfirm
  const prompt = ac.prompt ?? nativePrompt

  return [
    {
      id: 'detail',
      label: { zh: '详情', en: 'Details' },
      run: (node: CanvasNode) => {
        ac.onRequestDetail?.(node.ref)
      },
    },
    {
      id: 'rename',
      label: { zh: '重命名', en: 'Rename' },
      run: async (node: CanvasNode) => {
        const title = await prompt('请输入新的工作区标题', renameInitialValue(ac, node))
        if (title !== null && title.trim() !== '') {
          await ac.ctx.workspaces.rename(node.ref as never, title.trim())
        }
      },
    },
    {
      id: 'archive',
      label: { zh: '全部归档', en: 'Archive all' },
      run: async () => {
        const sessionIds = ac.view?.sessionIds ?? []
        const archived = new Set((ac.view?.archivedSessionIds ?? []).map(String))
        // 未归档会话 = 工作区账目内不在已归档集合的；全部归档是批量操作，
        // 执行前二次确认（dsh 语义：归档保留在 sessionIds 账目，分组界面隐藏，日志保留）。
        // 弹窗走 DSH 系统样式（与删除确认同款 Modal），文案由 ConfirmRequest 提供。
        const unarchived = sessionIds.filter((id) => !archived.has(String(id)))
        if (unarchived.length === 0) return
        const ok = await confirm({
          title: '全部归档',
          description: `确认归档全部 ${unarchived.length} 个会话？`,
          confirmLabel: '全部归档',
        })
        if (!ok) return
        // 逐个归档，失败时提示（不静默），全部成功则画布计数随 feed 更新（未归档数减少）。
        for (const sessionId of unarchived) {
          try {
            await ac.ctx.workspaces.archiveSession(sessionId as never)
          } catch (err) {
            ac.onNotify?.(err instanceof Error ? `归档会话失败：${err.message}` : '归档会话失败')
            return
          }
        }
      },
    },
    {
      id: 'delete',
      label: { zh: '删除（级联）', en: 'Delete (cascade)' },
      danger: true,
      run: async (node: CanvasNode) => {
        const memberCount = ac.store.read().nodes.filter(
          (n) => n.kind !== 'workspace' && n.workspaceId === node.ref,
        ).length
        const sessionCount = ac.view?.sessionIds.length ?? 0
        // 确认文案：会话将归档（dsh 语义归档=隐藏，避免散落到未分组）
        const ok = await confirm({
          title: '删除工作区',
          description: memberCount > 0 && sessionCount > 0
            ? `删除该工作区将归档其 ${sessionCount} 个会话、删除其 ${memberCount} 个成员节点与关系，确定？`
            : memberCount > 0
              ? `删除该工作区将同时删除其 ${memberCount} 个成员节点与关系，确定？`
              : sessionCount > 0
                ? `删除该工作区将归档其 ${sessionCount} 个会话，确定？`
                : '确定删除该工作区？',
          confirmLabel: '删除（级联）',
          danger: true,
        })
        if (!ok) return
        // 先归档全部会话（避免散落到未分组），再级联清理并删除工作区；
        // 归档失败不阻断删除（会话仍可落未分组）。
        for (const sessionId of ac.view?.sessionIds ?? []) {
          try {
            await ac.ctx.workspaces.archiveSession(sessionId as never)
          } catch {
            // 忽略单个归档失败
          }
        }
        removeWorkspaceCascade(ac.store, node.ref)
        await ac.ctx.workspaces.delete(node.ref as never)
      },
    },
  ]
}
