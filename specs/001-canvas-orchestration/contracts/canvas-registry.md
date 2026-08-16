# Contract: ctx.canvas 注册服务

> 画布向第三方插件暴露的扩展协议。消费方：节点/连线规则插件（浏览器半区）。
> 权威类型见 `packages/dsh-workspace-canvas/docs/protocol-spec.md` §3。

## 接入

```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 编排画布注册表（dsh-workspace-canvas 提供；缺席 = undefined）。 */
    canvas?: CanvasRegistry
  }
}
```

画布缺席时 `ctx.get('canvas') === undefined`，插件跳过注册、正常降级。

## 接口

```ts
interface CanvasRegistry {
  /** 注册节点类型；返回注销函数。 */
  registerNodeType(def: NodeTypeDefinition): () => void

  /** 向任意 kind（含内置 'workspace'）追加上下文菜单动作；返回注销函数。合并渲染：类型所有者 + 扩展，按 order 排序。 */
  registerNodeActions(kind: string, actions: NodeAction[], order?: number): () => void

  /** 向任意 kind 追加右侧明细区块；返回注销函数。合并渲染：类型所有者 detail + 扩展区块，按 order 排序。 */
  registerNodeDetailSection(kind: string, section: NodeDetailSection): () => void

  /** 注册连线规则；返回注销函数。 */
  registerEdgeRule(def: EdgeRuleDefinition): () => void

  /** 读当前画布文档（只读快照；内容变化时引用更新）。 */
  readDocument(): CanvasDocument

  /** 订阅文档变化。 */
  subscribe(fn: (doc: CanvasDocument) => void): () => void

  /** 写入（合并式）；画布负责校验/查重/持久化/广播；非法写入抛错。 */
  mutate(mutator: (draft: CanvasDocument) => void): void
}
```

## 语义要点

- kind 命名 `scope:type`（节点）/ `scope:edge`（边）；内置 `'workspace'`（节点）与 `'link'`（边）保留；
  重复注册同 kind → 后者抛错
- `mutate` 校验：kind 已注册、ref 可解析、workspaceId 归属完整、边完整性（§数据模型不变量）；
  失败 → 抛错拒绝（不静默删）
- 归属不是边：无 member 边类型
- 卸载兼容：插件卸载后节点「未知类型」占位、边「未知规则」占位，数据保留，重装恢复

## 验收（Contract test 覆盖）

1. 注册节点类型 → 成功；重复注册同 kind → 抛错
2. 画布缺席时 `ctx.get('canvas') === undefined`，消费方不报错
3. `mutate` 写非法（无归属节点 / 查重边 / 跨 scope link）→ 抛错拒绝
4. 注销函数调用后注册表移除对应条目
