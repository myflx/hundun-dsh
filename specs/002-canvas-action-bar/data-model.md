# Data Model: 画布底部操作栏

**Phase 1 输出**。本特征不引入新持久化实体——操作栏读写**既有** `CanvasDocument` 的
`view` 与 workspace 节点 `position` 字段。以下为操作栏涉及的既有实体与字段说明。

## 实体

### CanvasDocument（既有，key `dsh.workspaceCanvas.doc.v1`）

| 字段 | 类型 | 说明 | 操作栏读写 |
| --- | --- | --- | --- |
| `view` | `{ x, y, zoom }` | 视图变换（平移 + 缩放，scene 坐标） | 缩放控件 / 重置视图 / 聚焦读写 |
| `nodes[]`（kind=`workspace`） | `{ id, kind, ref, position }` | 工作区位置（scene 像素坐标） | 自动布局重写 `position` |

### WorkspaceListState（官方 feed，`ctx.workspaces.list`）

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| `items[]` | `WorkspaceView[]` | 工作区列表（workspaceId/title/path/sessionIds） | 自动布局排序来源 + 聚焦目标列表 |

## 状态与转换

### 视图（view）

- 初始：`store.read().view ?? { x:0, y:0, zoom:1 }`（既有）
- 缩放：`zoom * 1.1 | 0.9`，夹取 `[0.3, 3]`（既有 `clampZoom`）
- 重置：`{ x:0, y:0, zoom:1 }`（既有 `resetView`）
- **聚焦**：`focusView(view, targetSceneCenter, viewportSize)` → 新 `{ x, y, zoom 不变 }`
- 持久化：尾随防抖 400ms 写 `doc.view`（既有）

### 工作区位置（自动布局）

- 输入：feed 顺序的 `workspaceId[]`
- 计算：`autoPosition(index)` = `{ x: (index % 4) * 216 + 12, y: floor(index / 4) * 112 + 12 }`（既有）
- 写入：批量 `commitWorkspacePosition`（既有，防抖持久化）
- 不变量：布局后全部卡片包围盒两两不相交（列距 216 > 卡宽 200，行距 112 > 卡高 ~80）

## 约束（来自 spec FR）

- 操作栏按钮不可用时（无工作区：自动布局/聚焦）安全降级：禁用或空操作
- 聚焦目标缺失：提示且视图不变
- 操作栏不引入非系统设计令牌的硬编码视觉值
