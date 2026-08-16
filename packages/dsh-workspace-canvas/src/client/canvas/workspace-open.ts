/**
 * 点击工作区卡片 → 进入新会话（T012）。
 *
 * 兜底契约：startSession 可能同步抛错或返回 rejected Promise（工作区删除竞态等），
 * 一律捕获并交给 onError 提示，绝不产生未处理拒绝 / 未捕获异常。
 * 会话成功打开（同步返回或 Promise resolve）后回调 onSuccess——画布据此退出
 * 让位（E2E-02：进入会话后退出画布）。
 * id 泛型保留官方品牌类型（WorkspaceId）。
 */
export function openWorkspaceSession<S extends string>(
  workspaces: { startSession(id?: S): unknown },
  id: S,
  onError: (message: string) => void,
  onSuccess?: () => void,
): void {
  const succeed = (): void => onSuccess?.()
  try {
    const result = workspaces.startSession(id)
    const maybe = result as PromiseLike<unknown> | undefined
    if (maybe !== undefined && maybe !== null && typeof maybe.then === 'function') {
      maybe.then(succeed, (err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
    } else {
      succeed()
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
