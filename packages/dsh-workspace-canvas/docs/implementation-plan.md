# 落地实现计划（Implementation Plan）

> 把 [protocol-spec.md](protocol-spec.md) 的协议落地为代码的分阶段计划。
> 每阶段有明确任务、产出与验收标准；按序推进，前序完成才进入后序。
> 当前代码状态（P0）见文末「现状基线」。

---

## P0 —— 现状基线（已完成，实际运行中）

已实现（挂载于 web profile，HMR 开启）：

- 搜索框「画布视图」按钮（React + 官方 Tooltip，DOM 注入 + MutationObserver 自愈）
- 中间区域 DOM 接管（`absolute inset:0 z-index:60`，对话保持挂载）+ `dsh-panel-activate` 面板互斥
- 工作区卡片自动渲染（`ctx.workspaces.list` + `useSyncExternalStore`）、卡片拖拽（pointer events）
- 点击卡片 `startSession(workspaceId)` 进入

**P0 与协议的关系**：全部为「硬编码工作区卡片画布」，无协议/文档模型/服务。

## P1 —— 协议骨架（画布成为平台）

目标：`ctx.canvas` 服务、CanvasDocument v1 存储、节点/连线规则注册、内置 member/link 规则、连线交互框架。工作区迁移为内置节点类型。

### P1.1 文档模型与存储
- [ ] `CanvasDocument` 类型（TS）落地，`version: 1`
- [ ] `localStorage['dsh.workspaceCanvas.doc.v1']` 读写：加载（损坏备份 `.bak` + 空文档启动）、500ms 防抖写
- [ ] 文档迁移函数链 `migrate(doc)`（当前无旧版本，留接口）
- [ ] 验收：任意节点/边写入 → 刷新页面 → 布局恢复；写坏 JSON → 空文档 + `.bak` 备份

### P1.2 ctx.canvas 服务
- [ ] browser 半区 `apply` 中 `ctx.provide('canvas', registry)`（cordis Service）
- [ ] `registerNodeType` / `registerEdgeRule`：注册表 Map + 冲突检测（重复 kind 抛错）+ disposer
- [ ] `readDocument` / `subscribe` / `mutate`（校验/查重/持久化/广播）
- [ ] 消费方接入：`declare module` 类型 + `ctx.get('canvas')` 可选依赖（画布缺席降级）
- [ ] 验收：一个最小测试插件注册节点类型成功；画布缺席时 `ctx.get('canvas') === undefined` 不报错

### P1.3 内置节点类型与规则（工作区 = 强制 scope）
- [ ] 工作区基底节点 `kind: 'workspace'`（scope 容器）：`data.list` = `ctx.workspaces.list` 投影，`render` = 现有卡片外观，`actions` = 进入/重命名/删除（级联确认）/归档
- [ ] 内置 `member` 规则（**强制**：accepts = 源 workspace、目标非 workspace；arity.target = 1；每个编排节点必须恰有一条，缺失 → `meta.invalid='no-scope'`）与 `link` 规则（同工作区内任意两端；`crossScope: false` 缺省）
- [ ] **分区渲染**：按 member 边把节点分组到工作区区域；编排节点 `position` = 区域内坐标（渲染绝对位置 = 工作区位置 + 区域内坐标；拖工作区成员跟随）
- [ ] 存量 UI（现有硬编码卡片）迁移为「注册类型渲染」，删除硬编码路径
- [ ] 验收：画布渲染与 P0 视觉等价；未注册 kind 节点显示「未知类型」占位；无 member 节点显示「无归属」提示

### P1.4 连线交互框架
- [ ] 四边连接点渲染（hover 显示）+ 拖线手势（pointer events，`setPointerCapture`）
- [ ] 可连目标过滤：节点 `edgeKinds` ∩ 规则 `accepts` ∩ **scope 过滤**（非 crossScope 边仅同工作区内）；悬停高亮 + 不可连 `reason` 提示
- [ ] 建边管线（查重/arity/`await onConnect`/mutate）+ 删边（右键/拖回端口/`onDisconnect`）
- [ ] 默认贝塞尔渲染 + 端点方向滞回（hundun-web `edgePoint`/`EDGE_HYSTERESIS` 移植）+ 可拖弯曲
- [ ] `member` 交互：拖节点到工作区区域 = 建立/迁移 member 边；**拖出所有工作区区域 = 无效（无游离态，提示先选工作区）**；新建节点必须先落入工作区
- [ ] 删除工作区 = 级联删除其成员节点与边（确认提示）；删节点连带删边（先跑 `onDisconnect`）
- [ ] 文档加载校验：逐边 `validate` / 逐节点 kind 检查 / **member 不变量检查** → `meta.invalid` 标记
- [ ] 验收：同工作区两节点可拖线建边（link）；节点拖到工作区建立 member、拖到另一工作区迁移；刷新后边与归属恢复

**P1 出口标准**：任何第三方插件可在不碰画布代码的前提下注册节点类型与连线规则并完整工作。

## P2 —— 视图与布局

目标：画布成为「可自由浏览的编排面」。

- [ ] scene 坐标 + `view {x,y,zoom}` 变换；滚轮缩放（zoom 0.3~3）、空白 pan、`resetView`、`focusNode`/`focusWorkspace`（进入某工作区区域）
- [ ] `view` 并入文档持久化（`CanvasDocument.view`）
- [ ] GRID 自动布局：新节点落位 + 簇间碰撞推挤（`resolveClusterCollision` 移植）
- [ ] 对齐辅助线（`nodeCenters` + x/y 对齐参考线）
- [ ] 吸附：拖拽创建/拖到工作区（`SNAP_RADIUS`）
- [ ] 拖拽创建入口：从节点插件面板/搜索框拖出 ghost → 生成节点
- [ ] 性能：ResizeObserver 节流、节点视口裁剪（>100 节点降级策略评估）
- [ ] 验收：缩放平移流畅；新节点自动落位不重叠；拖拽对齐有参考线

## P3 —— 节点体验与面板

目标：节点可管理、画布可操作业务入口。

- [ ] 选中节点 → 右侧详情面板（工作区：会话列表/打开/新建/重命名/归档；编排节点：由节点插件渲染详情）
- [ ] 右键菜单框架（节点动作 `actions` + 边删除 + 通用项）
- [ ] 状态可视化：最近活跃（`recentWorkspaceId`）、会话数徽标、实例缺失态
- [ ] 边元数据编辑（`metaFields` 表单，连线后双击边编辑）
- [ ] 画布级 Toolbar：缩放控件、重置视图、节点类型菜单（列出已注册类型）
- [ ] 验收：面板/菜单/状态完整，第三方节点插件的动作与详情正常显示

## P4 —— 协议完善与稳定性（按需）

- [ ] 文档 v2：宿主 JSON 存储路由（跨浏览器共享）——**仅在需要时做**
- [ ] 性能压测（100+ 节点）与降级策略落地
- [ ] 协议测试套件：注册/校验/迁移/降级场景自动化测试

---

## 依赖关系

```text
P1.1 文档模型 ──► P1.2 ctx.canvas ──► P1.3 内置类型/规则 ──► P1.4 连线框架
                                                     └──────► P2 视图与布局 ──► P3 体验与面板 ──► P4（按需）
```

## 每阶段完成定义

- 代码：本阶段任务全数完成，`pnpm typecheck && pnpm build` 通过；
- 验证：挂载于 web profile，按本阶段「验收」逐条人工确认；
- 文档：阶段行为与 protocol-spec / capability-boundaries 一致（漂移即改文档）；
- 回归：P0 已有交互（按钮/画布/拖拽/互斥）不退化。
