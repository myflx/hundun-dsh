# Contract: 画布底部操作栏（Action Bar）

**Phase 1 输出**。操作栏是画布内部 UI 契约——DOM 标记与行为供单测、E2E 与未来功能点扩展引用。

## DOM 标记

| 标记 | 元素 | 含义 |
| --- | --- | --- |
| `[data-dsh-action-bar]` | `div` | 操作栏容器（画布底部浮层） |
| `[data-dsh-action-zoom-out]` | `button` | 缩小（步进 10%，夹取 ≥30%） |
| `[data-dsh-action-zoom-percent]` | `span` | 当前缩放百分比（整数，如 `110%`） |
| `[data-dsh-action-zoom-in]` | `button` | 放大（步进 10%，夹取 ≤300%） |
| `[data-dsh-action-reset]` | `button` | 重置视图（100% + 原点归位） |
| `[data-dsh-action-layout]` | `button` | 自动布局（GRID 重排全部工作区） |
| `[data-dsh-action-focus]` | `button` | 聚焦工作区（展开目标选择；仅平移、zoom 不变） |

> 右上角不再渲染独立缩放工具（整合后 `[data-dsh-canvas-toolbar]` 不复存在）。

## 行为契约

### 缩放（FR-003）

- 点放大/缩小：`zoom` 乘 1.1 / 0.9，夹取 `[0.3, 3]`；百分比显示实时更新
- 点重置（FR-004）：`zoom = 1`、`x = 0`、`y = 0`
- 视口/节点层变换随 view 更新（既有节点层 translate+scale，网格层不变）

### 自动布局（FR-007/FR-008）

- 输入：当前 feed 顺序的工作区列表
- 输出：每个工作区 position 重写为 `autoPosition(index)`；成员节点相对位置不变（成员存工作区局部坐标）
- 持久化：复用 `commitWorkspacePosition`（防抖写 doc）
- 无工作区：按钮禁用（`disabled`）

### 聚焦（FR-009）

- 选择目标工作区 → `focusView(view, 目标中心 scene 坐标, 视口尺寸)` → view 平移使目标居中，zoom 不变
- 目标不存在（feed 中消失）：不可选/提示，视图不变
- 无工作区：按钮禁用

### UI 一致性（FR-005/FR-006）

- 操作栏样式使用系统设计令牌（`--dsw-alias-surface-raised` 背景 / `--dsw-alias-border-l2` 边框 / `--dsw-alias-label-*` 文字 / `--dsw-alias-interactive-bg-hover` 悬停 / `--dsw-alias-state-*` 语义色）
- 浮层 `z-index` 低于右键菜单/明细面板；`pointer-events` 只作用于自身元素（不拦截画布拖拽/平移）

## 纯函数契约

### `focusView(view: ViewTransform, targetCenter: {x,y}, viewport: {w,h}): ViewTransform`

- 返回新 view：`{ x: viewport.w/2 - targetCenter.x * zoom, y: viewport.h/2 - targetCenter.y * zoom, zoom: view.zoom }`
- 纯函数（不改入参）；zoom 保持不变

### `autoLayoutWorkspaces(store, workspaceIds: string[]): void`

- 按 index 计算 `autoPosition(index)` 并批量 `commitWorkspacePosition`；空数组 = 空操作
