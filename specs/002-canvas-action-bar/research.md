# Research: 画布底部操作栏

**Phase 0 输出**。本特征无外部未知项（全部决策从既有代码库与 hundun-web 设计文档解析），
本文件记录关键决策与备选评估。

## 决策记录

### D1: 操作栏形态 —— 画布内 absolute 浮层（底部居中）

- **Decision**: 操作栏为 `CanvasView` 内部 absolute 浮层，`bottom` 定位、水平居中；替换现有右上角 `TOOLBAR_STYLE`
- **Rationale**: 既有右上角工具栏已是同构实现（absolute + zIndex 浮层），改造代价最小；「画布下方」即 bottom 定位；不占用官方槽位（遵循面板互斥协议）
- **Alternatives considered**: ① 独立底部栏组件（新文件/新挂载点）——无必要，CanvasView 内已持有 view 状态；② 官方槽位注册——违反画布「DOM 层接管」既定边界

### D2: 缩放整合 —— 复用既有 zoomBy/resetViewTransform，仅迁移位置

- **Decision**: 保留现有缩放逻辑（`zoomAt` 锚点缩放、0.3–3 夹取、10% 步进），把按钮从右上角迁移到底部操作栏；右上角不再渲染独立工具栏
- **Rationale**: FR-002（整合不重复）与 FR-003（步进/夹取一致）——逻辑零改动，纯布局迁移
- **Alternatives considered**: 重写缩放状态机——无必要，既有实现已通过单测与真机验证

### D3: 自动布局 —— 复用 autoPosition GRID 步进，批量提交

- **Decision**: 新增 `autoLayoutWorkspaces(store, workspaces)` 助手：按 feed 顺序用 `autoPosition(index)`（每行 4 列、步进 216×112、起点 +12）计算每个工作区目标位，批量 `commitWorkspacePosition`；成员节点相对位置自动保留（成员 position 为工作区局部坐标，随工作区移动）
- **Rationale**: 既有 `autoPosition` 已是 GRID 自动布局算法（CanvasView 初始布局用），复用即可保证「落在网格线上」；workspace 节点 position 是唯一改动点，成员不参与重排
- **Alternatives considered**: 碰撞推挤式重排（hundun-web resolveClusterCollision）——超出本规格（spec Assumptions 明确排除），且 GRID 重排更可预测

### D4: 聚焦工作区 —— focusView 纯函数平移居中

- **Decision**: 新增 `focusView(view, targetSceneCenter, viewportSize)` 纯函数：`x = viewportW/2 - target.x * zoom`、`y = viewportH/2 - target.y * zoom`（zoom 不变）；聚焦按钮展开工作区选择（下拉列表），目标缺失时提示且不动视图
- **Rationale**: 纯函数可单测（Contract test）；平移使 scene 目标在视口中心；FR-009 要求目标缺失提示——选择列表实时来自 feed，缺失即不可选（按钮禁用/提示）
- **Alternatives considered**: 缩放适配（改变 zoom 使目标适配视口）——spec Assumptions 明确「聚焦仅平移、不改缩放」

### D5: UI 一致性 —— 系统设计令牌

- **Decision**: 操作栏样式全部用 `var(--dsw-alias-*)`（surface-raised 背景、border-l2 边框、label-* 文字、interactive-bg-hover 悬停态、state-* 语义色），与既有画布工具栏/设置面板同源
- **Rationale**: FR-005（复用系统令牌）——既有工具栏已示范该范式，直接沿用
- **Alternatives considered**: 自绘设计语言——违反 FR-005

### D6: 测试策略

- **Decision**: Contract test（纯函数：focusView、autoLayoutWorkspaces）+ Integration test（操作栏渲染、按钮行为、缩放整合后右上角消失）+ playwright E2E（quickstart 场景真机断言）
- **Rationale**: 章程 I 条（TDD）+ II 条（运行时验证）——纯函数单测覆盖算法，真机覆盖交互与 UI 一致性
- **Alternatives considered**: 仅单测——无法验证「右上角不再出现」与「UI 与系统一致」这类渲染事实
