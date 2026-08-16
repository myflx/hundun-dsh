# Data Model: 画布操作栏（对齐 hundun-web）

**Phase 1 输出（v2）**。本特征不引入新持久化实体——操作栏读写**既有** `CanvasDocument.view`，
刷新驱动官方 workspaces feed 更新。

## 实体

### CanvasDocument（既有，key `dsh.workspaceCanvas.doc.v1`）

| 字段 | 类型 | 说明 | 操作栏读写 |
| --- | --- | --- | --- |
| `view` | `{ x, y, zoom }` | 视图变换（平移 + 缩放） | 缩小/放大/重置读写（防抖持久化） |

### WorkspaceListState（官方 feed，`ctx.workspaces.list`）

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| `items[]` | `WorkspaceView[]` | 工作区列表 | 「刷新」重新拉取后驱动画布更新 |

### workspaces 服务（`ctx.workspaces`）

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `list` | `ObservableSnapshot<WorkspaceListState>` | 标准 feed（订阅驱动画布） |
| `refresh()`（运行时） | `() => Promise<void>` | 重新拉取工作区基线（Wire-pump 入口；IWorkspaces 接口未暴露，运行时 WorkspaceRuntime 有） |

## 状态与转换

### 视图（view）

- 初始：`store.read().view ?? { x:0, y:0, zoom:1 }`（既有）
- 缩小/放大：`zoom * 0.9 | 1.1`（10% 步进），夹取 `[0.3, 3]`（既有 `clampZoom`）
- 重置：`{ x:0, y:0, zoom:1 }`（既有 `resetView`）
- 持久化：尾随防抖 400ms 写 `doc.view`（既有）

### 刷新（refresh）

- 触发：`(ctx.workspaces as { refresh?: () => Promise<void> }).refresh?.()`
- 效果：workspaces 基线重新拉取 → feed 更新 → CanvasView `useSyncExternalStore` 重渲染 → 画布反映
  新增/移除工作区；runtime 的 feed 订阅重跑工作区对账（syncWorkspaceNodes）
- 失败降级：refresh 缺失或抛错 → 静默（可选链 + void），画布保持原数据，不产生未处理异常

## 约束（来自 spec FR）

- 四按钮顺序固定：缩小 → 重置 → 放大 → 刷新（hundun-web 对齐，SC-003）
- 操作栏不引入非系统设计令牌的硬编码视觉值（SC-004）
- 刷新失败不报错（FR-005）
