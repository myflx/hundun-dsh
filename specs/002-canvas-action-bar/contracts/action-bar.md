# Contract: 画布操作栏（Canvas Controls，对齐 hundun-web）

**Phase 1 输出（v2）**。操作栏是画布内部 UI 契约——DOM 标记与行为供单测、E2E 与未来扩展引用。

## DOM 标记

| 标记 | 元素 | 含义 |
| --- | --- | --- |
| `[data-dsh-action-bar]` | `div` | 操作栏容器（画布底部浮层，水平居中） |
| `[data-dsh-action-zoom-out]` | `button` | 缩小（步进 10%，夹取 ≥30%）——hundun-web ZoomOut |
| `[data-dsh-action-reset]` | `button` | 重置视图（100% + 原点归位）——hundun-web LocateFixed/resetView |
| `[data-dsh-action-zoom-in]` | `button` | 放大（步进 10%，夹取 ≤300%）——hundun-web ZoomIn |
| `[data-dsh-action-refresh]` | `button` | 刷新（重新拉取工作区基线）——hundun-web RefreshCw |

> 四按钮顺序固定：缩小 → 重置 → 放大 → 刷新（SC-003）。
> 右上角不再渲染独立缩放工具（`[data-dsh-canvas-toolbar]` 不复存在，FR-002）。

## 行为契约

### 缩小 / 放大（FR-003）

- 点击：`zoom` 乘 0.9 / 1.1，夹取 `[0.3, 3]`；百分比显示实时更新
- 视口/节点层变换随 view 更新（既有：节点层 translate+scale，网格层不变）

### 重置（FR-004）

- 点击：`zoom = 1`、`x = 0`、`y = 0`；已是默认态时幂等（无多余写入）

### 刷新（FR-005）

- 点击：调用 `ctx.workspaces.refresh?.()`（workspaces 基线重新拉取）
- feed 更新 → 画布自动反映最新工作区（新增出现、移除消失）
- 刷新失败/能力缺失：静默降级（可选链兜底），画布保持原数据，零未处理异常

### UI 一致性（FR-006/FR-007）

- 操作栏样式使用系统设计令牌（`--dsw-alias-surface-raised` / `--dsw-alias-border-l2` /
  `--dsw-alias-label-*` / `--dsw-alias-interactive-bg-hover`）
- 按钮形态参考 hundun-web（约 30×30、圆角、透明背景、hover 高亮），视觉值走系统令牌
- 浮层 `z-index` 低于右键菜单/明细面板；`pointer-events` 只作用于自身元素（不拦截画布拖拽/平移）
