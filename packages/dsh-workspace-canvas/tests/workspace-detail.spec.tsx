/**
 * 工作区详情框重设计契约测试（003-detail-panel-redesign，TDD）。
 *
 * 验证 spec FR-002 / FR-003 / FR-006 / FR-009 的运行时行为：
 * - 无标题 → 语义占位「未命名工作区」，不裸显示随机码
 * - 分区：身份区（无标题，大字号名称） / 基本信息区（含工作区 ID，共 2 区）
 * - 工作区 ID 以「工作区 ID」标签 + 值 + 说明呈现（语义化）
 * - 最近活跃徽标按 recent 开关显隐
 * - 会话数「N 个会话」（含 0）
 * - 空路径 → 「未知路径」
 */
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceDetail } from '../src/client/canvas/detail/workspace-detail.tsx'

function renderDetail(props: {
  title?: string
  path?: string
  sessionIds?: string[]
  workspaceId?: string
  recent?: boolean
  sessionStats?: { total: number; active: number; archived: number; running: number }
}): { container: HTMLElement; cleanup(): void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(WorkspaceDetail, {
      view: {
        title: props.title ?? '我的工作区',
        path: props.path ?? '/home/user/proj',
        sessionIds: props.sessionIds ?? ['s1', 's2'],
        workspaceId: props.workspaceId ?? 'ws_1a2b3c4d',
      },
      recent: props.recent ?? false,
      sessionStats: props.sessionStats ?? { total: 2, active: 1, archived: 1, running: 0 },
    }))
  })
  return {
    container,
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

describe('WorkspaceDetail（工作区详情框重设计）', () => {
  let rendered: ReturnType<typeof renderDetail> | undefined

  beforeEach(() => { rendered = undefined })
  afterEach(() => { rendered?.cleanup(); localStorage.clear() })

  it('无自定义标题时显示路径文件夹名，不裸显示随机码（FR-003 补充）', () => {
    rendered = renderDetail({ title: '', path: '/home/user/my-proj', workspaceId: 'ws_secret123' })
    const text = rendered.container.textContent ?? ''
    expect(text).toContain('my-proj')
    // 标题（身份区 strong）不裸显示 ID
    const titleEl = rendered.container.querySelector('[data-dsh-ws-section="identity"] strong')
    expect(titleEl?.textContent).toBe('my-proj')
    expect(titleEl?.textContent ?? '').not.toContain('ws_secret123')
    // 基本信息区仍以语义化形式包含 ID（「工作区 ID」标签 + 值）
    expect(text).toContain('工作区 ID')
    expect(text).toContain('ws_secret123')
  })

  it('无标题且无路径时回退「未命名工作区」（FR-003 兜底）', () => {
    rendered = renderDetail({ title: '', path: '', workspaceId: 'ws_fallback' })
    const titleEl = rendered.container.querySelector('[data-dsh-ws-section="identity"] strong')
    expect(titleEl?.textContent).toBe('未命名工作区')
    expect(titleEl?.textContent ?? '').not.toContain('ws_fallback')
  })

  it('按身份/基本信息/会话/自动归档四区分区渲染（FR-001）', () => {
    rendered = renderDetail({})
    const sections = rendered.container.querySelectorAll('[data-dsh-ws-section]')
    expect(sections.length).toBe(4)
    const names = [...sections].map((s) => s.getAttribute('data-dsh-ws-section'))
    expect(names).toEqual(['identity', 'info', 'sessions', 'archive'])
    // 身份区无分区标题；信息/会话/归档卡片有标题
    const identity = rendered.container.querySelector('[data-dsh-ws-section="identity"]')
    expect(identity?.querySelector('h4')).toBeNull()
    expect(rendered.container.querySelector('[data-dsh-ws-section="info"] h4')?.textContent).toBe('基本信息')
    expect(rendered.container.querySelector('[data-dsh-ws-section="sessions"] h4')?.textContent).toBe('会话')
    expect(rendered.container.querySelector('[data-dsh-ws-section="archive"] h4')?.textContent).toBe('自动归档')
    // 工作区名称字号加大（18px，身份区 strong）
    const titleEl = rendered.container.querySelector('[data-dsh-ws-section="identity"] strong')
    expect(titleEl?.textContent).toBe('我的工作区')
    // 会话数量表格在会话卡片内，基本信息区不含表格
    const info = rendered.container.querySelector('[data-dsh-ws-section="info"]')
    expect(info?.querySelector('[data-dsh-ws-sessions]')).toBeNull()
    expect(rendered.container.querySelector('[data-dsh-ws-section="sessions"] [data-dsh-ws-sessions]')).not.toBeNull()
  })

  it('工作区 ID 语义化：标签 + 值 + 复制按钮（FR-002 / FR-004）', () => {
    rendered = renderDetail({ workspaceId: 'ws_xyz789' })
    const text = rendered.container.textContent ?? ''
    expect(text).toContain('工作区 ID')
    expect(text).toContain('ws_xyz789')
    expect(text).toContain('内部标识') // 语义说明
    const copyBtn = rendered.container.querySelector('[data-dsh-ws-copy]')
    expect(copyBtn).not.toBeNull()
    expect(copyBtn?.textContent).toBe('复制')
  })

  it('最近活跃以徽标呈现，非最近则不显示（FR-006）', () => {
    rendered = renderDetail({ recent: true })
    const badge = rendered.container.querySelector('[data-dsh-ws-section="identity"] span')
    expect(badge?.textContent).toContain('最近活跃')

    rendered.cleanup()
    rendered = renderDetail({ recent: false })
    const text = rendered.container.textContent ?? ''
    expect(text).not.toContain('最近活跃')
  })

  it('会话数量以表格展示总数/活跃/归档/运行中（FR-009）', () => {
    rendered = renderDetail({ sessionStats: { total: 5, active: 3, archived: 2, running: 1 } })
    const table = rendered.container.querySelector('[data-dsh-ws-sessions]')
    expect(table).not.toBeNull()
    const headers = [...(table?.querySelectorAll('th') ?? [])].map((h) => h.textContent)
    expect(headers).toEqual(['总数', '活跃', '归档', '运行中'])
    const cells = [...(table?.querySelectorAll('td') ?? [])].map((c) => c.textContent)
    expect(cells).toEqual(['5', '3', '2', '1'])

    rendered.cleanup()
    rendered = renderDetail({ sessionStats: { total: 0, active: 0, archived: 0, running: 0 } })
    const zeroCells = [...(rendered.container.querySelectorAll('[data-dsh-ws-sessions] td') ?? [])].map((c) => c.textContent)
    expect(zeroCells).toEqual(['0', '0', '0', '0'])
  })

  it('空路径显示「未知路径」（edge case）', () => {
    rendered = renderDetail({ path: '' })
    expect(rendered.container.textContent ?? '').toContain('未知路径')
  })

  it('基本信息区目录行取路径文件夹名（bugfix：有标题时也取文件夹名，而非工作区名称）', () => {
    // 有自定义标题 + 路径 → 目录仍为文件夹名（标题在顶行身份区）
    rendered = renderDetail({ title: '我的项目', path: '/home/user/proj' })
    const info = rendered.container.querySelector('[data-dsh-ws-section="info"]')
    const text = info?.textContent ?? ''
    expect(text).toContain('目录')
    expect(text).toContain('proj')
    expect(text).not.toContain('我的项目') // 目录不是工作区名称
    // 无标题 → 目录仍为文件夹名
    rendered.cleanup()
    rendered = renderDetail({ title: '', path: '/repo/my-folder' })
    const info2 = rendered.container.querySelector('[data-dsh-ws-section="info"]')
    expect(info2?.textContent ?? '').toContain('my-folder')
    // 路径为空 → 「未知目录」
    rendered.cleanup()
    rendered = renderDetail({ title: '有标题但无路径', path: '' })
    expect(rendered.container.textContent ?? '').toContain('未知目录')
  })

  it('复制按钮在剪贴板不可用时点击不抛错（降级路径，FR-004）', () => {
    rendered = renderDetail({ workspaceId: 'ws_fallback' })
    const copyBtn = rendered.container.querySelector<HTMLButtonElement>('[data-dsh-ws-copy]')
    expect(copyBtn).not.toBeNull()
    expect(() => {
      act(() => { copyBtn?.click() })
    }).not.toThrow()
  })

  it('自动归档区：默认跟随默认；切自定义即改即存（005）', () => {
    rendered = renderDetail({ workspaceId: 'ws_arch' })
    const section = rendered.container.querySelector('[data-dsh-ws-section="archive"]')
    expect(section).not.toBeNull()
    // 默认跟随默认（无自定义字段）
    expect(rendered.container.querySelector('[data-dsh-ws-archive-custom]')).toBeNull()
    // 切自定义（第二个 radio）→ 出现字段并持久化
    const radios = rendered.container.querySelectorAll<HTMLInputElement>('[name="archive-mode-ws_arch"]')
    expect(radios.length).toBe(2)
    act(() => { radios[1]!.click() })
    expect(rendered.container.querySelector('[data-dsh-ws-archive-custom]')).not.toBeNull()
    expect(localStorage.getItem('dsh.workspaceCanvas.archive.workspaces')).toContain('"mode":"custom"')
    // 启用开关即改即存
    act(() => {
      rendered!.container.querySelector<HTMLInputElement>('[data-dsh-ws-archive-enabled]')!.click()
    })
    expect(localStorage.getItem('dsh.workspaceCanvas.archive.workspaces')).toContain('"enabled":true')
  })

  it('自动归档区：切回跟随默认清除自定义（005）', () => {
    rendered = renderDetail({ workspaceId: 'ws_arch2' })
    const radios = rendered.container.querySelectorAll<HTMLInputElement>('[name="archive-mode-ws_arch2"]')
    act(() => { radios[1]!.click() }) // 自定义
    expect(localStorage.getItem('dsh.workspaceCanvas.archive.workspaces')).toContain('"mode":"custom"')
    act(() => { radios[0]!.click() }) // 跟随默认
    expect(localStorage.getItem('dsh.workspaceCanvas.archive.workspaces')).toBeNull()
    expect(rendered.container.querySelector('[data-dsh-ws-archive-custom]')).toBeNull()
  })
})
