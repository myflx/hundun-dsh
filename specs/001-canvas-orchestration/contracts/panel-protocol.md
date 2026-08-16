# Contract: 面板互斥协议（Panel Mutex Protocol）

> 中间区域面板（画布 / 任务看板 / SSH / 测试面板）之间的互斥约定。
> 设计决策 D4 + clarify Q3。共享实现位于 `@hundun/dsh-panel-protocol`（纯常量 + 工具，内联进各消费者 bundle）。

## 机制（单一激活标记，后写者胜）

| 对象 | 值 | 说明 |
|---|---|---|
| `data-dsh-panel-active` 属性 | `<panel-name>`（如 `workspace-canvas`、`hello-panel`） | 页面唯一激活标记，挂在 `documentElement`；后写者覆盖先写者 |
| `dsh-panel-activate` 事件 | `CustomEvent`，`detail` = `<panel-name>` | 激活时广播；收到事件且名字不是自己 → 关闭自己 |

## 行为约定

1. **激活**：面板打开时 —— 写 `data-dsh-panel-active = 自己名字` + dispatch `dsh-panel-activate(自己名字)`
2. **让位**：面板监听 `dsh-panel-activate`，收到 `detail !== 自己名字` → 关闭自己
3. **后写者胜**：不需要枚举/擦除其他面板的属性（单一标记天然覆盖）
4. **样式联动**：面板的显示条件 = `html[data-dsh-panel-active="<自己名字>"]`（如画布视图的 display 规则）

## 共享包 API（`@hundun/dsh-panel-protocol`）

```ts
/** 面板名常量（内置） */
export const PANELS = { workspaceCanvas: 'workspace-canvas', helloPanel: 'hello-panel' } as const
/** 激活标记属性名 */
export const ACTIVE_ATTR = 'data-dsh-panel-active'
/** 激活事件名 */
export const ACTIVATE_EVENT = 'dsh-panel-activate'

/** 自己是否当前激活（读标记） */
export function isActive(name: string): boolean
/** 声明激活：写标记 + 广播 */
export function activate(name: string): void
/** 监听他方激活事件；回调在“激活者非自己”时触发 */
export function onOtherActivate(name: string, fn: () => void): () => void
```

## 兼容性

- 现有 dsh-web-ui 家族（task-board / ssh）使用旧多属性协议（`data-dsh-taskboard-active` 等）；
  本仓库不依赖它们。将来整合时可在共享包内提供兼容桥（同时清/写旧属性），本阶段不做
- 测试对方面板：`dsh-hello` 改造（clarify Q3），面板名 `hello-panel`

## 验收（单测 + E2E-16/17）

1. 单测：`activate(A)` 后 `isActive(A) === true`、`isActive(B) === false`；A/B 先后激活 → 后者胜；
   `onOtherActivate` 回调只在他人激活时触发
2. E2E：画布打开时打开 dsh-hello 测试面板 → 画布让位；反之亦然（quickstart E2E-16/17）
