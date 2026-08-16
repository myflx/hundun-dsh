/**
 * dsh-hello 演示编排节点（T021）。
 *
 * 演示第三方插件如何接入画布平台（E2E-06/12/14 的载体）：经 canvas 服务注册
 * - 节点类型 `hundun:demo`（外观 render + 实例数据 list + 内置明细 detail）；
 * - 扩展右键动作（「示例动作」，E2E-12：第三方注册扩展动作 → 菜单出现并可执行）；
 * - 扩展明细区块（「演示区块」，E2E-14：明细含内置视图 + 扩展区块按序）。
 * 画布缺席时安全跳过。
 *
 * 时序（T021 修正）：canvas 服务由画布插件在 enabled 挂载时提供，可能晚于
 * 本插件 apply——监听画布 emit 的 `canvas/ready` / `canvas/unready` 事件注册/
 * 注销，并立即兜底查询一次（服务已就绪时直接注册）。
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { NodeAction, NodeDetailProps, NodeDetailSection, NodeTypeDefinition, CanvasRegistry } from '@hundun/dsh-workspace-canvas/client'

/** 注册演示节点类型（含扩展动作与明细区块）；返回 disposer（画布缺席时返回空操作）。 */
export function registerDemoNodeType(ctx: ClientContext): () => void {
  let disposeAll: (() => void) | undefined

  // canvas/ready 事件携带 registry 实例（cordis isolate 下跨插件 ctx.get 不可见，
  // 事件是跨 isolate 的通道；无参数时回退 get 尽力而为）。
  const register = (registry?: CanvasRegistry): void => {
    const canvas = registry ?? ctx.get('canvas', false) as CanvasRegistry | undefined
    if (canvas === undefined) return
    // 幂等：重开画布（重新 provide）前先清理旧注册
    disposeAll?.()
    const disposers: Array<() => void> = []
    disposers.push(canvas.registerNodeType(def))
    disposers.push(canvas.registerNodeActions('hundun:demo', [demoAction], 90))
    disposers.push(canvas.registerNodeDetailSection('hundun:demo', demoSection))
    disposeAll = () => { for (const d of disposers) d() }
  }
  const unregister = (): void => {
    disposeAll?.()
    disposeAll = undefined
  }

  // 跨包字符串事件契约（画布包声明 Events；独立包用 any 断言接入）
  const offReady = (ctx.on as any)('canvas/ready', register)
  const offUnready = (ctx.on as any)('canvas/unready', unregister)
  // 服务已就绪兜底（事件早于本插件监听发出时）
  register()

  return () => {
    offReady()
    offUnready()
    unregister()
  }
}

/** 演示节点类型定义（含内置明细 detail）。 */
const def: NodeTypeDefinition = {
  kind: 'hundun:demo',
  label: { zh: '示例节点', en: 'Demo node' },
  order: 100,
  data: {
    list: () => ({
      subscribe: () => () => {},
      getSnapshot: () => [],
    }),
  },
  render: (props) => createElement(
    'div',
    {
      'data-dsh-demo-node': props.node.id,
      style: {
        background: 'var(--dsw-alias-surface-raised, #fff)',
        border: '1px solid var(--dsw-alias-state-business-primary, #4a7)',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 12,
        cursor: 'pointer',
      },
      title: `${props.node.kind} · ${props.node.ref}`,
      // 平台契约：节点外观自行绑定点击 → 选中（右侧明细）
      onClick: (e: MouseEvent) => { e.stopPropagation(); props.onSelect() },
    },
    `${props.node.label ?? props.node.ref} · demo`,
  ),
  detail: (props: NodeDetailProps) => createElement(
    'div',
    { 'data-dsh-demo-detail': '', style: { display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' } },
    [
      createElement('div', { key: 'label' }, `标签：${props.node.label ?? props.node.ref}`),
      createElement('div', { key: 'ref' }, `引用：${props.node.ref}`),
      createElement('div', { key: 'kind' }, `类型：${props.node.kind}`),
    ],
  ),
}

/** 扩展右键动作（E2E-12：第三方注册扩展动作）。 */
const demoAction: NodeAction = {
  id: 'demo-activate',
  label: { zh: '示例动作', en: 'Demo action' },
  run: () => {
    // 可执行反馈：浏览器 alert（E2E-12 验证菜单出现并可执行）。
    if (typeof window !== 'undefined') window.alert('示例动作已执行（hundun:demo）')
  },
}

/** 扩展明细区块（E2E-14：明细含内置视图 + 扩展区块按序）。 */
const demoSection: NodeDetailSection = {
  label: { zh: '演示区块', en: 'Demo section' },
  order: 10,
  render: () => createElement(
    'div',
    { 'data-dsh-demo-section': '', style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } },
    '这是 dsh-hello 注册的扩展明细区块。',
  ),
}
