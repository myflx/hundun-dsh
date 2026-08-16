# 画布功能设计参考 —— 来自 hundun-web 的 WorkspaceGraph

> 来源项目：`D:\document\IdeaProjects\myflx-home\hundun-web`（Hundun Web，Agent 工作台）
> 核心实现：`src/App.tsx` 内的 `WorkspaceGraph` 组件（约 700 行画布逻辑）+ `components/Channel*` 系列
> 本文档把该项目的画布功能与设计机制记录到本插件（`dsh-workspace-canvas`），作为后续演进的设计参考。

---

## 1. hundun-web 画布功能全景

hundun-web 把「工作区 + Agent 实例」渲染成一张可自由操作的关系图：

| 功能 | 说明 |
| --- | --- |
| 节点 | 工作区簇核节点 + Agent 实例成员节点（独立组件 `ChannelInstanceNode`，三态可视化：pending/connected/disconnected） |
| 连线 | 成员 → 所属工作区的贝塞尔曲线，端点吸附节点四边，连线中部有可拖拽的弯曲手柄 |
| 拖拽 | 工作区（整体移动）、Agent 成员（相对工作区移动）、连线弯曲、从模板列表拖出创建新节点 |
| 平移/缩放 | 空白处拖动平移画布；滚轮缩放（1.1 / 0.9）；`resetView` 复位；`focusWorkspace` 平移居中某节点 |
| 吸附 | 拖拽创建时 ghost 吸附到工作区边缘（`SNAP_RADIUS`），自动选中连接边 |
| 对齐辅助线 | 拖动时对其它节点中心显示 x/y 对齐参考线 |
| 碰撞推挤 | 工作区簇间包围圆碰撞检测 + 实时斥力推挤（拖动时被挤开的簇自动让位） |
| 自动布局 | 新工作区按预设 GRID 落位；新 Agent 默认落在簇核右下（`DEFAULT_MEMBER_OFFSET`），冲突自动迭代推开 |
| 持久化 | `localStorage` 立即写（含时间戳）+ 500ms 防抖上传 `/api/graph-layout`（跨浏览器共享同一份布局）；加载时比较本地/服务端时间戳取新 |
| 交互细节 | 单击延迟 250ms 判双击（双击跳转聊天）；右键菜单（解绑/删除）；ESC 取消拖拽；`+` 号连接点弹添加菜单（一级/二级子菜单，可扩展组件类型） |
| 左右侧栏 | 画布左侧固定配置栏（`ChannelSidebar`，条目可拖出生成实例）；右侧详情栏（`ChannelDetailPanel`，QR 授权/状态/绑定管理） |
| 状态同步 | Agent 实例列表来自 `/api/agents`，工作区来自 `/api/workspaces`；实时刷新 |

## 2. 核心设计机制（可移植的精华）

### 2.1 坐标系：scene 百分比 + view 变换

```ts
type Position = { left: number; top: number; side?: ConnectionSide }; // scene 坐标（0-100 百分比）
type View = { x: number; y: number; zoom: number };                    // 平移 + 缩放
clientToScenePercent(clientX, clientY) => Position                     // 屏幕 → scene
```

- 节点位置全部存 **scene 百分比坐标**（与画布尺寸无关，跨屏/缩放稳定）；
- `view` 是纯显示层（平移量 + zoom），不写回节点数据；
- 渲染时 `left/top` 经 `view` 变换到屏幕像素。

### 2.2 渲染分层：Canvas 2D + SVG + DOM

| 层 | 内容 | 理由 |
| --- | --- | --- |
| `<canvas>` 2D | 网格背景、对齐辅助线、拖拽 ghost 指示 | 大量静态/高频线条，2D 成本低 |
| `<svg>` | 节点间贝塞尔连线 + 可拖弯曲手柄 | 矢量、可独立交互（拖 bend） |
| DOM | 节点本体（工作区/成员卡片） | 需要完整交互与内容渲染 |

- canvas 按 `devicePixelRatio` 缩放保证清晰度；`ResizeObserver` 重绘。

### 2.3 节点模型：簇核绝对 + 成员相对

- 工作区簇核：`positions[ws.id]` = 绝对 scene 坐标；
- Agent 成员：`positions['agent-rel:' + instanceId]` = **相对簇核的偏移**（`Offset {dx,dy}`），拖簇核 = 成员整体跟随；
- 旧格式 `agent:{id}` 绝对坐标启动时自动迁移为相对格式；
- 成员尺寸近似常量（`MEMBER_HALF_W/H`）用于几何计算，连线端点用 DOM `getBoundingClientRect()` 实测。

### 2.4 单一拖拽状态机

```ts
type DragState =
  | { kind: "workspace"; id; from: Position; fromScene; ... }
  | { kind: "agent"; id; instanceId; from: Offset; ... }
  | { kind: "picker-agent"; slug; name; avatar; x; y; targetId; targetSide? }  // 拖拽创建 ghost
  | { kind: "link"; instanceId; fromBend; ... }                                 // 拖连线弯曲
  | { kind: "pan"; startX; startY; x; y };
```

- **单一 `dragRef` + 全局 pointermove/pointerup 监听**（而非每个节点各自监听）；
- 视觉实时跟随（setState 高刷），drop 时才提交业务动作；
- `pendingDrag`：从弹框列表拖出时「按下移动超 4px 才真正激活」，纯点击不打断弹框原交互；
- ref 持有最新状态（`viewRef/positionsRef/agentsRef`）避免闭包过期、避免监听反复重挂。

### 2.5 连线：四边连接点 + 方向滞回 + 可拖弯曲

- 每节点暴露 `ConnectionSide = top|right|bottom|left` 连接点（hover 显示 `+`，点击弹添加菜单）；
- 端点出口方向用 `edgePoint()` 判定，并用**滞回带**（`EDGE_HYSTERESIS`）避免节点轻微移动时端点在对角线附近跳变；
- 连线为三次贝塞尔（`getLinkGeometry`：control1/control2 + 中点 handle）；
- 拖 handle：把拖拽位移投影到连线的法线方向（`perpendicular`），得到 `bend` 值（clamp ±18）。

### 2.6 吸附与对齐

- 拖拽创建：`SNAP_RADIUS = 0.16`（scene 百分比）内吸附到工作区边缘，记录 `targetSide`；
- 对齐辅助线：`nodeCenters()` 收集其它节点中心，拖动节点中心与其 x/y 对齐时显示参考线（`alignLines`）。

### 2.7 碰撞推挤（簇间斥力）

- 每个工作区簇算包围圆（`clusterRadius`）；
- 拖动/落位时两两检测：距离 < 半径和 → 沿圆心方向推开（`resolveClusterCollision`）；
- 新成员落位冲突时迭代推挤直到不重叠。

### 2.8 持久化：本地即时 + 服务端共享

- 写：`localStorage` 立即写（key + 时间戳）→ 500ms 防抖 `PUT /api/graph-layout`；
- 读：启动时取本地与服务端，**时间戳新者胜**（避免拖拽后防抖未上传就刷新导致位置回退）；
- 旧格式迁移：`agent:{id}` 绝对坐标 → `agent-rel:{id}` 相对偏移（一次性）。

### 2.9 交互细节沉淀

- 单击延迟 250ms 等双击判定（双击跳转），单击执行前可被双击取消；
- `pointer` 事件统一（触摸/鼠标同路），`stopPropagation` 防止画布 pan 与节点拖拽互相干扰；
- 节点选中高亮、右键菜单（portaled）、ESC 关闭菜单/取消拖拽。

## 3. dsh-workspace-canvas 现状与差距

当前本插件（已实现）：

- ✅ 网格背景画布（24px，CSS linear-gradient，铺满中间区域）
- ✅ 工作区卡片（标题/路径/会话数），官方 `ctx.workspaces.list` 实时数据
- ✅ 卡片自由拖拽（pointer events + `setPointerCapture`，5px 阈值区分点击/拖动）
- ✅ 点击卡片进入工作区新会话（`startSession`）
- ✅ 中间区域 DOM 接管 + 面板互斥（复用 `dsh-panel-activate`）

差距（hundun-web 有而本插件没有）：

| 能力 | 说明 | 依赖 |
| --- | --- | --- |
| 缩放/平移 | 滚轮缩放、空白 pan、scene 坐标 + view 变换 | 纯前端 |
| 连线 | 贝塞尔连线、四边连接点、可拖弯曲（几何/交互机制） | 连线语义由插件规则提供（`registerEdgeRule`，见 protocol-spec §3.4）；P1.4 落地交互框架 |
| 拖拽创建 | 从列表拖出 ghost 生成节点、吸附到边 | 需新节点类型（如「快捷会话」）；P2 落地 |
| 对齐辅助线 | 拖动时 x/y 对齐参考 | 纯前端 |
| 碰撞推挤/自动布局 | 簇间斥力、GRID 落位 | 纯前端 |
| 位置持久化 | localStorage + 防抖（画布文档 v1） | 画布文档模型 `CanvasDocument`（见 protocol-spec §2），存「引用+布局+关系」，无业务数据 |
| 节点详情面板 | 右侧详情栏（选中工作区后显示会话/操作） | `ctx.workspaces` + `ctx.sessions` 有数据 |
| 节点状态可视化 | 运行中/最近活跃等三态 | `WorkspaceListState.recentWorkspaceId` 已有 |

## 4. 演进路线（能力映射参考）

> 本文档写于画布「导航面」阶段；画布定位已升级为**编排画布**（节点类型与连线规则插件化）。
> 落地分期以 [implementation-plan.md](implementation-plan.md) 为准，本节只做**能力映射**——
> hundun-web 的机制分别落入哪个阶段：

| hundun-web 机制 | 落入阶段 | 说明 |
| --- | --- | --- |
| scene 坐标 + view 变换、缩放/平移、resetView | P2 视图与布局 | 照搬 `clientToScenePercent`/`view` 模型 |
| 连线（贝塞尔 + 端点方向滞回 + 可拖弯曲） | P1.4 连线交互框架 | 渲染与几何照搬；**连线语义改由插件规则提供**（`registerEdgeRule`） |
| 四边连接点（ConnectionPoints） | P1.4 连线交互框架 | 拖线手势 + 可连目标过滤（接入 accepts） |
| 对齐辅助线（nodeCenters） | P2 视图与布局 | 照搬 |
| 碰撞推挤（resolveClusterCollision） | P2 视图与布局 | 照搬 |
| GRID 自动布局 / 新成员默认落位 | P2 视图与布局 | 照搬 |
| 拖拽创建 ghost + 吸附（SNAP_RADIUS） | P2 视图与布局 | ghost 由「已注册节点类型」驱动，吸附改为建立 `member` 边 |
| 单一拖拽状态机（DragState + pendingDrag） | P1.4 / P2 | 状态机照搬，kind 枚举扩展为注册表驱动 |
| localStorage + 500ms 防抖持久化 | P1.1 文档模型与存储 | key 升级为 `dsh.workspaceCanvas.doc.v1`，存整个 `CanvasDocument` |
| 旧格式迁移 | P1.1 / P2 | 迁移函数链 `migrate(doc)`（协议版本驱动） |
| 簇核/成员模型（成员相对偏移） | P1.3 内置规则 | 保留：工作区 = 簇核/scope，成员 = **区域内相对坐标**（scope 强制，成员不可脱离）；区域内可自由排布，编排连线默认限同工作区内 |
| 右侧详情面板（ChannelDetailPanel） | P3 节点体验与面板 | 详情由节点插件渲染，画布只提供面板框架 |
| 节点三态可视化（ChannelInstanceNode） | P3 节点体验与面板 | 状态字段由节点插件提供（如最近活跃/运行中） |
| 左右侧栏（配置/详情） | P3（可选） | 遵循能力边界：不占用官方槽位，画布内面板自持 |

### 不做（或需谨慎）
- 双画布互斥之外的 DOM 深入改造（跟随 dsh-ssh/任务看板的既有协议）；
- 多用户协作（DSH 无此概念，布局共享可退化为宿主 JSON 存储）；
- 无限画布/大图性能优化（先保持 DOM 节点，必要时再分层 canvas）。

## 5. 源码索引（hundun-web）

| 内容 | 位置 |
| --- | --- |
| 画布主组件（坐标系/拖拽/连线/吸附/碰撞/持久化） | `hundun-web/src/App.tsx`（`WorkspaceGraph`，约 142-1268 行） |
| 画布布局与网格样式 | `hundun-web/styles.css`（`.workspace-grid`，27 行附近） |
| 画布节点（三态可视化） | `hundun-web/components/ChannelInstanceNode.tsx` |
| 画布左侧配置栏（可拖出生成实例） | `hundun-web/components/ChannelSidebar.tsx` |
| 画布右侧详情栏（授权/状态/绑定） | `hundun-web/components/ChannelDetailPanel.tsx` |
| 布局持久化 API | `hundun-web/app/api/graph-layout/` |
| 设计文档 | `hundun-web/docs/channel-design.zh-CN.md` |
