import { describe, expect, it, vi } from 'vitest'
import { openWorkspaceSession } from '../src/client/canvas/workspace-open.ts'

describe('openWorkspaceSession（T012）', () => {
  it('同步成功调用 startSession，无错误回调', () => {
    const startSession = vi.fn(() => undefined)
    const onError = vi.fn()
    openWorkspaceSession({ startSession }, 'ws-1', onError)
    expect(startSession).toHaveBeenCalledWith('ws-1')
    expect(onError).not.toHaveBeenCalled()
  })

  it('startSession 同步抛错 → onError 收到消息（无未捕获异常）', () => {
    const onError = vi.fn()
    expect(() => openWorkspaceSession(
      { startSession: () => { throw new Error('boom') } },
      'ws-1',
      onError,
    )).not.toThrow()
    expect(onError).toHaveBeenCalledWith('boom')
  })

  it('startSession 返回 rejected Promise → onError 收到消息（无未处理拒绝）', async () => {
    const onError = vi.fn()
    const rejection = Promise.reject(new Error('async boom'))
    rejection.catch(() => {}) // 吞掉测试自身的未处理拒绝探测
    openWorkspaceSession({ startSession: () => rejection }, 'ws-1', onError)
    await Promise.resolve()
    expect(onError).toHaveBeenCalledWith('async boom')
  })

  it('返回 resolved Promise → 不触发 onError', async () => {
    const onError = vi.fn()
    openWorkspaceSession({ startSession: () => Promise.resolve() }, 'ws-1', onError)
    await Promise.resolve()
    expect(onError).not.toHaveBeenCalled()
  })
})
