/**
 * 点击工作区卡片 → 进入新会话（T012）。
 *
 * 兜底契约：startSession 可能同步抛错或返回 rejected Promise（工作区删除竞态等），
 * 一律捕获并交给 onError 提示，绝不产生未处理拒绝 / 未捕获异常。
 * id 泛型保留官方品牌类型（WorkspaceId）。
 */
export function openWorkspaceSession<S extends string>(
  workspaces: { startSession(id?: S): unknown },
  id: S,
  onError: (message: string) => void,
): void {
  try {
    const result = workspaces.startSession(id)
    const maybe = result as PromiseLike<unknown> | undefined
    if (maybe !== undefined && maybe !== null && typeof maybe.then === 'function') {
      maybe.then(undefined, (err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
