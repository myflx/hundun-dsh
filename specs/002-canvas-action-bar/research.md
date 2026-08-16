# Research: 画布操作栏（对齐 hundun-web）

**Phase 0 输出（v2）**。用户澄清：操作按钮 = hundun-web `canvas-controls` 的四个功能项
（缩小/重置/放大/刷新）。本文件记录关键决策。

## 决策记录

### D1: 操作项来源 —— hundun-web `canvas-controls` 四按钮

- **Decision**: 操作栏按序提供四按钮：**缩小 → 重置 → 放大 → 刷新**（对齐 hundun-web
  `src/App.tsx` L1375-1380：ZoomOut → LocateFixed(resetView) → ZoomIn → RefreshCw）
- **Rationale**: 用户明确「按照 hundun-web 画布的操作实现（缩小、放大、重置、刷新）」——功能项与顺序
  以 hundun-web 为准；刷新（RefreshCw）是用户点名的关键新增（重新拉取画布数据）
- **Alternatives considered**: ① 自动布局/聚焦按钮（v1 误读）——用户未要求，移除；② 百分比显示——
  hundun-web 无百分比文本（纯图标按钮），但保留百分比显示更直观且不冲突（spec FR-003 步进可感知）

### D2: 操作栏形态 —— 画布内 absolute 浮层（底部居中）

- **Decision**: `CanvasView` 内 absolute 浮层，`bottom` 定位、水平居中；替换现有右上角 `TOOLBAR_STYLE`
- **Rationale**: 既有右上角工具栏同构（absolute + zIndex 浮层），改造代价最小；「画布下方」= bottom 定位
- **Alternatives considered**: 独立组件/官方槽位——无必要，CanvasView 已持有 view 状态；槽位违反既有边界

### D3: 缩放/重置 —— 复用既有 zoomBy/resetViewTransform，仅迁移位置

- **Decision**: 保留既有缩放逻辑（`zoomAt` 锚点缩放、10% 步进、0.3–3 夹取）与 `resetView`（{0,0,1}），
  按钮迁移到底部操作栏；右上角不再渲染独立工具栏
- **Rationale**: hundun-web 缩放行为（0.9/1.1 步进）与既有实现一致；夹取范围沿用既有 0.3–3
  （hundun-web 为 0.65–1.8，DSH 采用更宽范围兼容既有体验，spec Assumptions 注明）
- **Alternatives considered**: 严格对齐 0.65–1.8——破坏既有测试与体验，无必要

### D4: 刷新 —— 调用 workspaces 基线重新拉取

- **Decision**: `handleRefresh` 调 `(ctx.workspaces as { refresh?: () => Promise<void> }).refresh?.()`；
  feed 更新后 CanvasView 经 `useSyncExternalStore` 自动重渲染；刷新失败（无 refresh/抛错）静默降级
- **Rationale**: hundun-web `refreshCanvas = setCanvasRevision+1 + onRefresh()`（重新拉取数据）；DSH 的
  workspaces 服务具体类 `WorkspaceRuntime` 提供 `refresh(): Promise<void>`（「Refresh the workspace
  baseline, reusing an in-flight pull」，L 确认）——语义完全对应；IWorkspaces 接口未暴露 refresh，
  用可选链调用运行时方法并兜底
- **Alternatives considered**: 本地 revision 强制重渲染（hundun-web setCanvasRevision）——feed 驱动已
  自动重渲染，无需额外 revision；本地重新同步 doc——workspaces 刷新后 runtime 的 feed 订阅自动重跑对账

### D5: UI 一致性 —— 系统设计令牌

- **Decision**: 操作栏样式全部用 `var(--dsw-alias-*)`（surface-raised / border-l2 / label-*），
  与既有画布/设置面板同源；按钮 30×30 图标风格对齐 hundun-web（width/height/border-radius/transparent/hover）
- **Rationale**: FR-006 复用系统令牌；hundun-web 按钮形态（30px 圆角 5px hover 高亮）作为布局参考，
  视觉值全部走系统令牌（SC-004）
- **Alternatives considered**: 自绘设计语言——违反 FR-006

### D6: 测试策略

- **Decision**: Integration test（action-bar.spec：四按钮渲染/顺序、缩放/重置行为、刷新调用 mock）+
  playwright E2E（quickstart 场景真机断言，含刷新后数据更新）
- **Rationale**: 章程 I/II 条——按钮行为与刷新调用可单测 mock；刷新数据更新与 UI 一致性需真机验证
- **Alternatives considered**: 仅单测——无法验证「右上角不再出现」与「刷新后画布随 feed 更新」
