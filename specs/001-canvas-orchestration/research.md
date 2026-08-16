# Research: 编排画布（Canvas Orchestration）

> Phase 0 输出。把 plan.md Technical Context 中的未知点与选型固化为决策；每条含 Decision / Rationale / Alternatives。
> 依据：定稿设计文档 + 既有代码（P0 实现）+ 本机 DSH 运行时实测（slot 契约、SDK 类型）。

## R1 坐标与视图模型

- **Decision**: 场景绝对像素坐标 + 视图变换（`position` = px；`view {x,y,zoom}` 为「镜头」，缩放平移不改坐标）
- **Rationale**: 画布地基——「东西在哪」与「怎么看」分离；区域尺寸变化/缩放下位置不漂移（设计决策 D1）
- **Alternatives**: 百分比坐标（缩放/区域变化漂移，P2 必返工）；像素+百分比混用（两套换算，复杂）

## R2 归属模型

- **Decision**: 节点 `workspaceId` 字段（业务工作区 id），**不是 member 边**；edges 只表达关联（link/扩展）
- **Rationale**: 归属是简单关系；建模成边会让查重/删边/拖线全系统特判（设计决策 D2）；字段校验 O(1)
- **Alternatives**: member 边（概念对称但复杂度泄漏）；parentId 指向画布内部节点 id（工作区重挂需重指，不如业务 id 稳）

## R3 面板互斥协议

- **Decision**: 单一激活标记 `data-dsh-panel-active="<name>"` + `dsh-panel-activate` 事件（后写者胜）；
  协议常量/工具抽共享包 `@hundun/dsh-panel-protocol`（设计决策 D4，clarify Q3）
- **Rationale**: 画布只需看「标记是不是我」，不需要枚举所有面板；新面板零改动；常量一处维护
- **Alternatives**: 现状多属性硬编码（要认识所有面板，改名即失效）；纯 DOM 事件无属性（刷新后状态丢失）

## R4 官方数据面（workspaces / sessions）

- **Decision**: 数据经官方 `ctx.workspaces` / `ctx.sessions` 服务读取；工作区实例数据实时投影、画布只存档位置与 ref；
  写操作（进入/重命名/删除/归档）走官方 API（`startSession` / `rename` / `delete` / `archiveSession`）
- **Rationale**: 画布不缓存/不复制业务数据（capability-boundaries §1）；数据一致性由官方 feed 保证
- **Alternatives**: 自行持久化工作区元数据（与官方脱节、重复数据源，弃）

## R5 设置面接入

- **Decision**: 设置页「hundun-dsh」由聚合包 `dsh-all` 注册（`settings.section` + 子槽位）；
  画布注册「画布」栏目；宿主侧 `installSettingsSection`（`@deepseek-ai/dsh-settings`）+ 客户端
  `settingsScope.bind`（`@deepseek-ai/dsh-client-ui-settings`）；schema 用 schemastery
  （设计决策 D10，clarify Q1：enabled 关闭时实时卸载）
- **Rationale**: 聚合品牌设置面归聚合包，栏目按插件扩展；双半区联动落实 D5 统一总开关
- **Alternatives**: 画布插件自注册整页（未来插件加栏目要改画布代码，弃）；仅组合文件配置（无 UI，弃）

## R6 中间区域 DOM 接管与自愈

- **Decision**: 保留 DOM 接管（`[data-pane="conversation"]`，absolute + z-index，对话保持挂载），
  但把两套 MutationObserver 合并为**单一挂载监督器**，观察范围收窄到侧边栏/对话列两个锚点子树；
  选择器集中为「挂载点契约」模块
- **Rationale**: `conversation` 槽位单占用，官方未开放全局视图槽，DOM 接管是当前唯一路径；
  收窄观察范围降低与 shell 复杂度线性相关的开销；选择器集中便于 DSH 升级回归（设计评审 G 项）
- **Alternatives**: 官方槽位方案（无可用全局视图槽）；保持两套观察器（职责重叠，弃）

## R7 持久化与降级

- **Decision**: `localStorage['dsh.workspaceCanvas.doc.v1']` 500ms 防抖写；损坏 → `.bak` 备份 + 空文档启动 + 提示；
  `migrate()` 迁移链（版本号并入 key）；配额满 → 只读降级 + 一次性提示
- **Rationale**: 单用户单浏览器，localStorage 足够；降级契约保证「不崩溃、不静默删」（protocol-spec §7）
- **Alternatives**: 宿主 JSON 文件路由（v2 跨浏览器共享，按需再做）；无持久化（布局刷新即丢，P0 缺陷，弃）

## R8 性能（≤100 工作区/节点）

- **Decision**: DOM 渲染卡片（≤100）；拖动用 pointer events + `setPointerCapture` + rAF 节流提交；
  帧间隔 <100ms 验收（SC-002，clarify Q4）；超过 100 的降级（静态层转 canvas 2D）留 P2 评估
- **Rationale**: 100 节点 DOM 完全可承受；避免过早引入 canvas 2D 复杂度（capability-boundaries §5）
- **Alternatives**: 直接 canvas 2D 渲染（过早优化，维护成本高，弃）

## R9 测试策略

- **Decision**: vitest（jsdom）分三层：单元（controller 状态机/互斥/拖拽阈值）、Contract（文档校验引擎：
  workspaceId 不变量/查重/arity/crossScope/迁移）、Integration（注册→渲染→归属→明细链路）；E2E 走
  quickstart.md 人工/GUI 验证（25 条场景，章程 IV 门禁）
- **Rationale**: 章程 I（TDD）+ III（四字段任务）+ IV（E2E 门禁）；校验逻辑（平台承诺）必须先测后写
- **Alternatives**: 纯人工验证（改动越多越怕，弃）；E2E 自动化（Playwright 后置，本阶段人工 GUI 为准）

## R10 dsh-hello 改造为互斥测试面板

- **Decision**: 在 dsh-hello 客户端半区增加一个简单面板（复用 `@hundun/dsh-panel-protocol` 参与互斥协议），
  作为互斥 E2E 的对方面板（clarify Q3，可随意改动）
- **Rationale**: 聚合仓库内自包含、可立即验证互斥协议；将来整合真实 task-board/SSH 时复用同一协议即可
- **Alternatives**: 新建专用桩面板插件（多一个包，收益低，弃）；等真实面板（阻塞验收，弃）

## 汇总

| 未知点 | 结论 | 状态 |
|---|---|---|
| 坐标模型 | 场景像素 + view 变换 | 已定（D1） |
| 归属模型 | workspaceId 字段 | 已定（D2） |
| 互斥协议 | 单标记 + 共享包 | 已定（D4/Q3） |
| 数据面 | 官方 feed 投影 + 官方写 API | 已定 |
| 设置面 | dsh-all 骨架 + 画布栏目 | 已定（D10/Q1） |
| DOM 接管 | 保留 + 单一监督器 | 已定 |
| 持久化 | localStorage v1 + 降级链 | 已定 |
| 性能 | ≤100 DOM + 指标量化 | 已定（Q4） |
| 测试 | vitest 三层 + E2E | 已定（章程） |
| 互斥对方面板 | dsh-hello 改造 | 已定（Q3） |

**残留 NEEDS CLARIFICATION**：无。
