import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasRuntime } from '../src/client/runtime.ts'
import { CanvasSettingsCard } from '../src/client/settings.ts'
import { CANVAS_ENABLED_KEY, setCanvasEnabled } from '../src/client/enabled-store.ts'
import { CANVAS_BACKGROUND_KEY } from '../src/client/background-store.ts'
import { DOC_STORAGE_KEY } from '../src/client/canvas/document.ts'

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('画布设置栏目（T032，本地持久化）', () => {
  it('渲染开关并反映当前值；切换 → localStorage 持久化 + 广播', async () => {
    setCanvasEnabled(true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard))
    })
    const input = container.querySelector<HTMLInputElement>('[data-dsh-canvas-enabled-switch]')
    expect(input).not.toBeNull()
    expect(input!.checked).toBe(true)
    await act(async () => { input!.click() })
    expect(localStorage.getItem(CANVAS_ENABLED_KEY)).toBe('false')
    expect(input!.checked).toBe(false)
    await act(async () => root.unmount())
  })

  it('未设置过 → 默认开启（true）', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard))
    })
    const input = container.querySelector<HTMLInputElement>('[data-dsh-canvas-enabled-switch]')
    expect(input!.checked).toBe(true)
    await act(async () => root.unmount())
  })

  it('分组布局：启用组 + 画布背景风格组（6 个单选，切换持久化，004）', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasSettingsCard))
    })
    const groups = container.querySelectorAll('[data-dsh-settings-group]')
    expect(groups.length).toBe(2)
    expect(groups[0].getAttribute('data-dsh-settings-group')).toBe('enabled')
    expect(groups[1].getAttribute('data-dsh-settings-group')).toBe('background')
    // 6 个背景风格选项，默认网格选中
    const options = container.querySelectorAll('[data-dsh-background-setting]')
    expect(options.length).toBe(6)
    const grid = container.querySelector<HTMLInputElement>('[data-dsh-background-setting="grid"] input')
    expect(grid!.checked).toBe(true)
    // 切换点阵 → 持久化
    await act(async () => {
      container.querySelector<HTMLInputElement>('[data-dsh-background-setting="dots"] input')!.click()
    })
    expect(localStorage.getItem(CANVAS_BACKGROUND_KEY)).toBe('dots')
    expect(container.querySelector<HTMLInputElement>('[data-dsh-background-setting="dots"] input')!.checked).toBe(true)
    expect(container.querySelector<HTMLInputElement>('[data-dsh-background-setting="grid"] input')!.checked).toBe(false)
    await act(async () => root.unmount())
  })
})

describe('CanvasRuntime 挂载/卸载（T033）', () => {
  function makeCtx(feedReady = true): any {
    return {
      locale: { register: () => () => {} },
      workspaces: {
        list: {
          subscribe: () => () => {},
          getSnapshot: () => ({ items: [], baselinesReady: feedReady }),
        },
      },
      effect: () => () => {},
      provide: () => () => {},
      emit: () => {},
      get: () => undefined,
      slots: { inject: () => () => {}, register: () => () => {} },
    }
  }

  it('mount 装配、unmount 全部回收（均幂等）', () => {
    const runtime = new CanvasRuntime(makeCtx())
    expect(runtime.isMounted).toBe(false)
    runtime.mount()
    expect(runtime.isMounted).toBe(true)
    runtime.mount() // 幂等：不重复装配
    runtime.unmount()
    expect(runtime.isMounted).toBe(false)
    runtime.unmount() // 幂等
  })

  it('feed 未就绪时 mount 不清除已存工作区位置（刷新还原 bugfix）', () => {
    // 预置已存档位置（模拟刷新前拖拽落盘）
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify({
      version: 1,
      nodes: [{ id: 'ws:w1', kind: 'workspace', ref: 'w1', position: { x: 192, y: 102 } }],
      edges: [],
    }))
    const runtime = new CanvasRuntime(makeCtx(false)) // feed 未就绪（刷新后首帧）
    runtime.mount()
    // 跳过对账 → 不 mutate → 存档原值保留（未被当作「消失」清除/重建为 0,0）
    const doc = JSON.parse(localStorage.getItem(DOC_STORAGE_KEY) ?? '{}')
    const wsNode = doc.nodes?.find((n: { ref: string }) => n.ref === 'w1')
    expect(wsNode?.position).toEqual({ x: 192, y: 102 })
    runtime.unmount()
  })

  it('feed 就绪且工作区确实消失 → 级联清理（E2E-21 语义）', async () => {
    vi.useFakeTimers()
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify({
      version: 1,
      nodes: [
        { id: 'ws:gone', kind: 'workspace', ref: 'gone', position: { x: 1, y: 2 } },
        { id: 'm1', kind: 'hundun:demo', ref: 'r1', workspaceId: 'gone', position: { x: 3, y: 4 } },
      ],
      edges: [],
    }))
    // feed 就绪但只有 w1（gone 已从官方列表消失）
    const ctx = makeCtx(true)
    ctx.workspaces.list.getSnapshot = () => ({ items: [{ workspaceId: 'w1' }], baselinesReady: true })
    const runtime = new CanvasRuntime(ctx)
    runtime.mount()
    vi.advanceTimersByTime(600) // 等防抖落盘
    const doc = JSON.parse(localStorage.getItem(DOC_STORAGE_KEY) ?? '{}')
    const refs = doc.nodes?.map((n: { ref?: string }) => n.ref).filter(Boolean)
    expect(refs).toEqual(['w1']) // gone 及其成员被清理
    runtime.unmount()
    vi.useRealTimers()
  })
})
