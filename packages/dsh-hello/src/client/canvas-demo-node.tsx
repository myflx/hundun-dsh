/**
 * dsh-hello 演示编排节点（T021）。
 *
 * 演示第三方插件如何接入画布平台：经 `ctx.get('canvas')` 注册一个节点类型
 * （kind `hundun:demo`，含外观 render 与实例数据 list）。画布缺席时安全跳过。
 * 该节点作为互斥/编排验收的测试面板配套（可随意改动）。
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { NodeTypeDefinition } from '@hundun/dsh-workspace-canvas/client'

/** 注册演示节点类型；返回 disposer（画布缺席时返回空操作）。 */
export function registerDemoNodeType(ctx: ClientContext): () => void {
  const canvas = ctx.get('canvas')
  if (canvas === undefined) return () => {}

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

  return canvas.registerNodeType(def)
}
