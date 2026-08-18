# 落地实现计划（Implementation Plan）

> 把 [protocol-spec.md](protocol-spec.md) 的协议落地为代码的分阶段计划。
> 每阶段有明确任务、产出与验收标准；按序推进，前序完成才进入后序。
> 设计已于定稿阶段完成（关键决策见 [orchestration-design.md §9](orchestration-design.md#9-设计决策记录)），
> 本计划按定稿后的模型（像素坐标 + workspaceId 归属 + 单一激活标记互斥）编写。

---

## P0 —— 现状基线（已完成，实际运行中）

已实现（挂载于 web profile，HMR 开启）：

- 搜索框「画布视图」按钮（React + 官方 Tooltip，DOM 注入 + MutationObserver 自愈）
- 中间区域 DOM 接管（`absolute inset:0 z-index:60`，对话保持挂载）+ 面板互斥（旧协议）
- 工作区卡片自动渲染（`ctx.workspaces.list` + `useSyncExternalStore`）、卡片拖拽（pointer events）
- 点击卡片 `startSession(workspaceId)` 进入

**P0 与定稿协议的关系**：全部为「硬编码工作区卡片画布」，无协议/文档模型/服务；
且 P0 代码用的是旧设计（member 思维、百分比坐标、多属性互斥），P0.5 统一改造。

## P0.5 —— 设计定稿落地（对齐新设计，先做）

目标：把 P0 代码对齐定稿设计，修掉评审发现的缺陷；不改功能范围，只改结构与健壮性。

- [ ] **互斥协议改造**：多属性互斥 → 单一激活标记 `data-dsh-panel-active="<name>"` + `dsh-panel-activate`
      事件（后写者胜）；移除对 taskboard/ssh 属性名的硬编码枚举
- [ ] **共享协议包**：聚合仓库新增 `packages/dsh-panel-protocol`（事件名/属性名常量 + 激活/监听工具函数），
      画布从该包引用；文档记录对 官方共享预设 旧协议的兼容桥（可选，整合那些面板时再加）
- [ ] **配置语义统一**：`enabled` 总开关双半区生效（`enabled=false` 时客户端跳过按钮与画布挂载）；
      `announceToAgent` 仅控制宿主公告
- [ ] **防重复挂载**：client apply 增加 apply-guard（首应用生效，卸载释放，参考 任务看板 同款模式）
- [ ] **挂载监督器合并**：把按钮自愈与画布挂载的两套 MutationObserver 合并为单一挂载监督器，
      观察范围收窄到侧边栏/对话列两个锚点子树
- [ ] **健壮性补丁**：`startSession` 失败 catch；`CanvasView` 增加 ErrorBoundary 兜底（渲染崩不白屏）
- [ ] **单测基建 + 首批测试**：vitest 接入；覆盖控制器状态机（open/close/toggle/dispose）、
      互斥协议（激活/让位/后写者胜）、拖拽阈值判定
- [x] **画布设置页（自持 settings.section）**：画布注册 `settings.section`「workspace-canvas」页面
      （label 本地化），页面直接渲染分组内容；**不再依赖聚合包 dsh-all 骨架/子槽位**
      （dsh-all 客户端半区降为空壳）；设置项：启用画布开关 `enabled` + 背景风格 + 自动归档（005）
- [ ] **设置链路联动**：`enabled=false` 时客户端跳过按钮与画布挂载、宿主关公告；开关经设置面
      双半区生效；无设置服务时读组合配置兜底
- [ ] 验收：功能与 P0 等价不退化；`pnpm typecheck && pnpm build` 通过；互斥协议单测全绿；
      设置页「画布」开关可关/开画布（双半区）

## P1 —— 协议骨架（画布成为平台）

目标：`ctx.canvas` 服务、CanvasDocument v1 存储（像素坐标 + workspaceId 归属）、
节点/连线规则注册、内置 link 规则、连线交互框架。工作区迁移为内置节点类型（投影 + 位置存档）。

### P1.1 文档模型与存储
- [ ] `CanvasDocument` 类型（TS）落地，`version: 1`：节点含 `workspaceId`（编排节点必填），
      坐标 = 场景像素（`position`） + 视图（`view {x,y,zoom}`）
- [ ] `localStorage['dsh.workspaceCanvas.doc.v1']` 读写：加载（损坏备份 `.bak` + 空文档启动）、500ms 防抖写
- [ ] 文档迁移函数链 `migrate(doc)`（当前无旧版本，留接口）
- [ ] 验收：任意节点/边写入 → 刷新页面 → 布局恢复；写坏 JSON → 空文档 + `.bak` 备份

### P1.2 ctx.canvas 服务
- [ ] browser 半区 `apply` 中 `ctx.provide('canvas', registry)`（cordis Service）
- [ ] `registerNodeType` / `registerEdgeRule`：注册表 Map + 冲突检测（重复 kind 抛错）+ disposer
- [ ] `registerNodeActions(kind, actions)` / `registerNodeDetailSection(kind, section)`：扩展注册 +
      合并渲染（类型所有者 + 扩展，按 order 排序）+ disposer
- [ ] `readDocument` / `subscribe` / `mutate`（校验/查重/持久化/广播）
- [ ] 消费方接入：`declare module` 类型 + `ctx.get('canvas')` 可选依赖（画布缺席降级）
- [ ] 验收：一个最小测试插件注册节点类型成功；画布缺席时 `ctx.get('canvas') === undefined` 不报错

### P1.3 内置节点类型与规则（工作区 = 强制 scope）
- [ ] 工作区基底节点 `kind: 'workspace'`（scope 容器）：**文档存档（ref = 工作区 id + position），
      实例数据实时投影** `ctx.workspaces.list`；feed 新增 → 自动补建节点，feed 消失 → 提示 + 级联清理成员
- [ ] **归属 = `workspaceId` 字段**（非边）：新建编排节点必须落入工作区（写 workspaceId）；
      拖到另一工作区 = 迁移（一次 mutate，位置重置为区域局部坐标）
- [ ] **分区渲染**：按 `workspaceId` 把节点分组到工作区区域；编排节点 `position` = 区域内局部坐标（px），
      渲染绝对位置 = 工作区位置 + 局部坐标；拖工作区成员整体跟随
- [ ] **工作区右键菜单**：进入 / 重命名 / 删除（级联确认，列出成员数）/ 归档会话；
      扩展动作（`registerNodeActions`）合并渲染
- [ ] **右侧明细面板**：点击节点/工作区 → 右侧弹出明细；工作区内置明细 = 基础信息 + 会话列表；
      类型所有者 `detail` + 扩展区块（`registerNodeDetailSection`）按 order 合并渲染
- [ ] 存量 UI（现有硬编码卡片）迁移为「注册类型渲染」，删除硬编码路径
- [ ] 验收：画布渲染与 P0 视觉等价；未注册 kind 节点显示「未知类型」占位；无归属节点显示「无归属」提示

### P1.4 连线交互框架（link / 扩展边；待租户确认后启动）
- [ ] 四边连接点渲染（hover 显示）+ 拖线手势（pointer events，`setPointerCapture`）
- [ ] 可连目标过滤：节点 `edgeKinds` ∩ 规则 `accepts` ∩ **scope 过滤**（非 crossScope 边仅同工作区内，
      按两端 `workspaceId` 相等判定）；悬停高亮 + 不可连 `reason` 提示
- [ ] 建边管线（查重/arity/`await onConnect`/mutate）+ 删边（右键/拖回端口/`onDisconnect`）
- [ ] 默认贝塞尔渲染 + 端点方向滞回（参考实现 `edgePoint`/`EDGE_HYSTERESIS` 移植）+ 可拖弯曲
- [ ] 文档加载校验：逐边 `validate` / 逐节点 kind 检查 / **workspaceId 不变量检查** → `meta.invalid` 标记
- [ ] 验收：同工作区两节点可拖线建边（link）；刷新后边与归属恢复

**P1 出口标准**：任何第三方插件可在不碰画布代码的前提下注册节点类型与连线规则并完整工作。

> **P1.4 启动门槛**：需**至少一个外部节点类型租户**（如 任务看板 任务节点 / 既有插件 主机节点）承诺接入
> `ctx.canvas` 后才启动（决策 D-租户，见 orchestration-design §9）。P1.1–P1.3 不依赖此门槛。

## P2 —— 视图与布局

目标：画布成为「可自由浏览的编排面」。

- [ ] scene 坐标 + `view {x,y,zoom}` 变换；滚轮缩放（zoom 0.3~3）、空白 pan、`resetView`、`focusNode`/`focusWorkspace`（进入某工作区区域）
- [ ] `view` 并入文档持久化（`CanvasDocument.view`）
- [ ] GRID 自动布局：新节点落位 + 簇间碰撞推挤（`resolveClusterCollision` 移植）
- [ ] 对齐辅助线（`nodeCenters` + x/y 对齐参考线）
- [ ] 吸附：拖拽创建/拖到工作区（`SNAP_RADIUS`）
- [ ] 拖拽创建入口：从节点插件面板/搜索框拖出 ghost → 生成节点（须先落入工作区，写 workspaceId）
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

## 测试计划（随实现同步落地）

| 层 | 测试内容 | 阶段 |
| --- | --- | --- |
| 控制器状态机 | open/close/toggle/dispose、互斥让位 | P0.5 |
| 互斥协议 | 单一标记读写、后写者胜、事件广播 | P0.5 |
| 拖拽判定 | 5px 阈值、点击 vs 拖动 | P0.5 |
| 设置链路 | 开关 → 双半区生效（enabled=false 不挂 UI + 关公告）、组合配置兜底 | P0.5 |
| 文档校验引擎 | workspaceId 不变量、查重、arity、crossScope、损坏恢复 | P1.1–P1.4 |
| 注册协议 | registerNodeType/EdgeRule 冲突、disposer、降级 | P1.2 |
| 迁移与降级 | migrate 链、.bak 恢复、未知类型占位 | P1+ |

> 原则：**校验逻辑（平台承诺）必须先有测试再实现**；每个 P 阶段的「验收」含对应测试全绿。

## 依赖关系

```text
P0.5 设计定稿落地（互斥/配置/guard/观察器/单测）
  │
  ▼
P1.1 文档模型 ──► P1.2 ctx.canvas ──► P1.3 内置类型/归属/分区渲染 ──► P1.4 连线框架（需租户确认）
                                                          └──────► P2 视图与布局 ──► P3 体验与面板 ──► P4（按需）
```

## 每阶段完成定义

- 代码：本阶段任务全数完成，`pnpm typecheck && pnpm build` 通过；
- 验证：挂载于 web profile，按本阶段「验收」逐条人工确认；
- 测试：本阶段列出的测试全绿（P0.5 起）；
- 文档：阶段行为与 protocol-spec / capability-boundaries 一致（漂移即改文档并翻「落地状态」标记）；
- 回归：P0 已有交互（按钮/画布/拖拽/互斥）不退化。
