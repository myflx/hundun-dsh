/**
 * dsh-hello 演示编排节点（T021）。
 *
 * 演示第三方插件如何接入画布平台：经 canvas 服务注册一个节点类型
 * （kind `hundun:demo`，含外观 render 与实例数据 list）。画布缺席时安全跳过。
 *
 * 时序（T021 修正）：canvas 服务由画布插件在 enabled 挂载时提供，可能晚于
 * 本插件 apply——监听画布 emit 的 `canvas/ready` / `canvas/unready` 事件注册/
 * 注销，并立即兜底查询一次（服务已就绪时直接注册）。
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { NodeTypeDefinition, CanvasRegistry } from '@hundun/dsh-workspace-canvas/client'

/** 注册演示节点类型；返回 disposer（画布缺席时返回空操作）。 */
export function registerDemoNodeType(ctx: ClientContext): () => void {
  let disposeType: (() => void) | undefined

  // canvas/ready 事件携带 registry 实例（cordis isolate 下跨插件 ctx.get 不可见，
  // 事件是跨 isolate 的通道；无参数时回退 get 尽力而为）。
  const register = (registry?: CanvasRegistry): void => {
    const canvas = registry ?? ctx.get('canvas', false) as CanvasRegistry | undefined
    if (canvas === undefined) return
    // 幂等：重开画布（重新 provide）前先清理旧注册
    disposeType?.()
    disposeType = canvas.registerNodeType(def)
  }
  const unregister = (): void => {
    disposeType?.()
    disposeType = undefined
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

/** 演示节点类型定义。 */
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
    },
    `${props.node.label ?? props.node.ref} · demo`,
  ),
}
