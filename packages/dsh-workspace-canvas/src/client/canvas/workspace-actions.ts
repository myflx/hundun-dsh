/**
 * 工作区内置右键动作（T024）。
 *
 * 进入 / 详情 / 重命名 / 归档会话 / 删除（级联确认）。
 * - 删除：确认（列出将删除的成员数）→ 级联清理画布成员 → 官方 workspaces.delete；
 * - 重命名 / 归档 / 进入走官方 API；
 * - confirm/prompt 可注入（测试用），缺省 window 实现。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { CanvasDocument, CanvasDocumentStore, CanvasNode } from './document.ts'
import type { NodeAction } from './registry.ts'
import { openWorkspaceSession } from './workspace-open.ts'
import { removeWorkspaceCascade } from './workspace-nodes.ts'

export interface WorkspaceActionContext {
  ctx: ClientContext
  store: CanvasDocumentStore
  doc: CanvasDocument
  /** 工作区实例（feed 投影，供归档会话取 sessionIds）。 */
  view?: { sessionIds: ReadonlyArray<string> }
  onRequestDetail?(workspaceId: string): void
  onNotify?(message: string): void
  confirm?(message: string): boolean
  prompt?(message: string, initial?: string): string | null
}

function nativeConfirm(message: string): boolean {
  return typeof window !== 'undefined' ? window.confirm(message) : false
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
      id: 'enter',
      label: { zh: '进入', en: 'Open' },
      run: (node: CanvasNode) => {
        openWorkspaceSession(ac.ctx.workspaces, node.ref as never, (m) => ac.onNotify?.(m))
      },
    },
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
        const title = prompt('请输入新的工作区标题', node.label ?? node.ref)
        if (title !== null && title.trim() !== '') {
          await ac.ctx.workspaces.rename(node.ref as never, title.trim())
        }
      },
    },
    {
      id: 'archive',
      label: { zh: '归档会话', en: 'Archive sessions' },
      run: async () => {
        // dsh 语义：归档保留在 sessionIds 账目，分组界面隐藏——逐个归档，
        // 失败时提示（不静默），全部成功则画布计数随 feed 更新（未归档数减少）。
        for (const sessionId of ac.view?.sessionIds ?? []) {
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
        const ok = confirm(
          memberCount > 0
            ? `删除该工作区将同时删除其 ${memberCount} 个成员节点与关系，确定？`
            : '确定删除该工作区？',
        )
        if (!ok) return
        removeWorkspaceCascade(ac.store, node.ref)
        await ac.ctx.workspaces.delete(node.ref as never)
      },
    },
  ]
}
