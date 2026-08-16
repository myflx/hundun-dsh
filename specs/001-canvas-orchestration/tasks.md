# Tasks: 编排画布（Canvas Orchestration）

**Input**: Design documents from `/specs/001-canvas-orchestration/`

**Prerequisites**: plan.md（技术栈/结构）、spec.md（用户故事与优先级）、data-model.md、contracts/（canvas-registry / panel-protocol / settings / workspace-feed）、research.md

**Tests**: spec.md 已声明 `**TDD**: true` —— 每个用户故事阶段 MUST 含 Contract test 与 Integration test 任务（项目章程 I 条）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format（四字段，全必填，项目章程 III 条）

```text
- [ ] T### [P?] [USx?] 描述 `file: 文件路径` `function: 函数/组件名` `calls: API/函数调用` `verify: 运行时可验证行为`
```

`file` / `function` / `calls` / `verify` 全必填（`calls` 无则填「无」）。**禁止** `verify: tsc 通过 / build 成功 / 代码已实现`；
标记 `[X]` 的唯一依据是 `verify` 行为真实通过（章程 II 条）。

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 新包与测试/构建基建就绪（互不依赖，可并行）

- [X] T001 [P] 新建 `@hundun/dsh-panel-protocol` 包骨架（package.json / tsconfig / tsdown.config / exports，接入 monorepo） `file: packages/dsh-panel-protocol/package.json` `function: 无（新包）` `calls: 无` `verify: pnpm -r list 显示 @hundun/dsh-panel-protocol；workspace 可 resolve 其入口`
- [X] T002 [P] 实现互斥协议常量与工具（PANELS / ACTIVE_ATTR / ACTIVATE_EVENT / isActive / activate / onOtherActivate） `file: packages/dsh-panel-protocol/src/index.ts` `function: activate / isActive / onOtherActivate` `calls: 无` `verify: Contract test：activate('a') 后 isActive('a')===true 且 isActive('b')===false；先后激活后写者胜；onOtherActivate 仅在他人激活时触发`
- [X] T003 [P] dsh-workspace-canvas 接入 vitest + jsdom（devDeps、vitest.config.ts、首条冒烟测试） `file: packages/dsh-workspace-canvas/package.json` `function: 无（基建）` `calls: pnpm install` `verify: pnpm -r --filter @hundun/dsh-workspace-canvas test 能收集并跑通 tests/ 下冒烟用例`
- [X] T004 [P] dsh-all 客户端半区脚手架（dsh.client 字段、tsconfig/tsdown、aggregate.yml 增 self 行并重跑 aggregate） `file: packages/dsh-all/package.json` `function: 无（新半区）` `calls: node scripts/aggregate.mjs` `verify: 重跑 aggregate 后 packages/dsh-all/cordis.patch.yml 含 self 行；dsh-all 构建产出 lib/client.js`

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 定稿设计的基础件——互斥协议接入、防重挂载、挂载监督器、文档模型、注册服务、配置语义。全部完成后 US 才可开工。

- [X] T005 画布控制器接入单标记互斥（写 data-dsh-panel-active + 广播 + 他方激活让位；删除旧多属性枚举） `file: packages/dsh-workspace-canvas/src/client/canvas/controller.ts` `function: CanvasController.applyActive / onOtherActivate / open / close` `calls: @hundun/dsh-panel-protocol activate / isActive / onOtherActivate` `verify: 单测：open() 后 documentElement 的 data-dsh-panel-active==='workspace-canvas'；收到其他面板激活事件后 close()；代码不再引用 data-dsh-taskboard-active / data-dsh-ssh-active`
- [X] T006 客户端 apply-guard（首应用生效、卸载释放，防 HMR/重复加载双挂载） `file: packages/dsh-workspace-canvas/src/client/index.ts` `function: claimCanvasApply / releaseCanvasApply` `calls: 无` `verify: 单测：同页面第二次 apply 调用被忽略（claim 返回 false）；effect 释放后恢复可 claim`
- [X] T007 单一挂载监督器（合并按钮自愈与画布挂载两套 MutationObserver，观察范围收窄到侧边栏/对话列锚点子树） `file: packages/dsh-workspace-canvas/src/client/canvas/mount-supervisor.ts` `function: MountSupervisor.ensure / dispose` `calls: MutationObserver` `verify: 单测：模拟侧边栏/对话列重建后画布与按钮自动重挂；卸载后观察器全部断开`
- [X] T008 CanvasDocument v1 文档模型与存储（类型 + localStorage 读写 + 500ms 防抖 + .bak 损坏恢复 + migrate 链） `file: packages/dsh-workspace-canvas/src/client/canvas/document.ts` `function: loadDocument / saveDocument / migrate` `calls: localStorage` `verify: 单测：写入→重读一致；连续写入合并为一次落盘；坏 JSON → 生成 .bak + 空文档启动；配额满（setItem 抛 QuotaExceededError）→ 只读降级 + 一次性提示且内存文档不丢`
- [ ] T009 ctx.canvas 注册服务（registerNodeType / registerNodeActions / registerNodeDetailSection / registerEdgeRule / readDocument / subscribe / mutate + 校验） `file: packages/dsh-workspace-canvas/src/client/canvas/registry.ts` `function: CanvasRegistry.*` `calls: ctx.provide('canvas') / document.mutate` `verify: Contract test：注册→注销→重复 kind 注册抛错；mutate 非法写入（无归属节点 / 查重边 / 跨 scope link）抛错拒绝；画布缺席时 ctx.get('canvas')===undefined 消费方不报错`
- [ ] T010 配置语义双半区（enabled 总开关 + announceToAgent；宿主公告随配置联动） `file: packages/dsh-workspace-canvas/src/index.ts` `function: apply / syncAnnouncement` `calls: installSettingsSection / ctx.systemPrompt.section` `verify: 单测：enabled=false 时公告段落不注册；enabled=true 时注册；设置源变化后即时增删`

**Checkpoint**: 基础件就绪 —— US 实现可并行开工。

---

## Phase 3: User Story 1 - 工作区总览与快速进入（Priority: P1）🚩 MVP

**Goal**: 画布入口稳定挂载；一屏总览全部工作区；点击直达新会话；空/加载状态完整。
**Independent Test**: 打开画布 → 全部工作区卡片 → 点击进入新会话 → 关闭恢复对话（E2E-01/02/03）。

- [ ] T011 [US1] 画布入口按钮接入挂载监督器（原自愈逻辑迁移，观察器并入 T007） `file: packages/dsh-workspace-canvas/src/client/search-button.tsx` `function: mountSearchButton / tryPlace` `calls: MountSupervisor` `verify: 单测：搜索行渲染后按钮出现；行重建后同帧重插；卸载后按钮与样式移除`
- [ ] T012 [US1] 点击进入新会话 + startSession 失败兜底 `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: WorkspaceCard.onOpen` `calls: workspaces.startSession` `verify: 单测：点击卡片调用 startSession(workspaceId)；mock 失败时提示且无 unhandled rejection`
- [ ] T013 [US1] 空状态与加载状态（无工作区 / feed 未就绪） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: CanvasView 渲染分支` `calls: 无` `verify: 单测：无工作区渲染空状态引导；baselinesReady 前渲染加载态`
- [ ] T014 [US1] US1 集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us1.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us1 测试全绿；quickstart E2E-01/02/03 逐条通过并记录`

---

## Phase 4: User Story 2 - 布局持久化（Priority: P1）

**Goal**: 拖拽位置刷新不丢；损坏数据不崩溃。
**Independent Test**: 拖乱卡片 → 刷新 → 位置一致；坏数据 → 提示 + 空布局（E2E-04/05）。

- [ ] T015 [US2] 拖拽位置提交画布文档（防抖写入 document，接入 T008） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: commitPosition` `calls: document.mutate` `verify: 单测：拖动提交后 localStorage 中 nodes 位置更新；连续拖动合并为一次写；拖动过程帧间隔 <100ms（性能断言，SC-002）`
- [ ] T016 [US2] 加载恢复与损坏提示流程（启动时读文档 → 恢复位置 / 提示 + 空文档） `file: packages/dsh-workspace-canvas/src/client/canvas/document.ts` `function: loadDocument 启动分支` `calls: 无` `verify: 单测：预置文档加载后画布位置与文档一致；坏 JSON 走 .bak 恢复路径`
- [ ] T017 [US2] US2 集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us2.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us2 测试全绿；quickstart E2E-04/05 逐条通过并记录`

---

## Phase 5: User Story 3 - 编排画布平台：节点与连线（Priority: P1）

**Goal**: 第三方可注册节点类型/动作/明细区块/连线规则；节点强制归属；同区连线数据合法（拖线手势 P1.4 待租户，本阶段只落协议与校验）。
**Independent Test**: 测试插件注册节点类型 → 渲染 → 拖入工作区建归属 → 同区 link 数据合法（E2E-06/07；E2E-08/09 待手势）。

- [ ] T018 [US3] 工作区节点投影同步（feed 订阅：新增自动补建、消失提示并级联清理成员） `file: packages/dsh-workspace-canvas/src/client/canvas/view/workspace-nodes.ts` `function: syncWorkspaceNodes` `calls: ctx.workspaces.list subscribe / document.mutate` `verify: 单测：mock feed 增删 → 文档节点自动补建/清理；成员级联删除；无业务数据写入文档`
- [ ] T019 [US3] 分区渲染（场景像素坐标 + 区域局部坐标换算；拖工作区成员整体跟随） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: 渲染位置计算 / 拖拽提交` `calls: 无` `verify: 单测：编排节点绝对位置 = 工作区位置 + 局部坐标；拖工作区后成员相对位置不变（整体跟随）`
- [ ] T020 [US3] link 边数据模型与校验接入（写入/查重/crossScope 校验；删节点连带删边；不实现拖线手势） `file: packages/dsh-workspace-canvas/src/client/canvas/document.ts` `function: validateEdges / removeNodeCascade` `calls: 无` `verify: Contract test：同区 link 合法写入；跨区默认拒绝；同 kind/source/target 查重拒绝；删节点连带删其边`
- [ ] T021 [US3] 注册表类型接入测试插件（最小节点类型 demo：注册→渲染→归属） `file: packages/dsh-hello/src/client/canvas-demo-node.tsx` `function: registerDemoNodeType` `calls: ctx.get('canvas').registerNodeType` `verify: E2E-06：demo 节点出现在画布并按注册外观渲染；E2E-07：无归属节点被要求先落入工作区`
- [ ] T022 [US3] US3 Contract/集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us3.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us3 测试全绿；E2E-06/07 通过；E2E-08/09（拖线）标注待 P1.4 手势`

---

## Phase 6: User Story 4 - 工作区管理与可扩展右键操作（Priority: P2）

**Goal**: 右键菜单（进入/重命名/删除级联/归档）+ 扩展动作合并。
**Independent Test**: 右键菜单动作齐全；删除确认级联；扩展动作出现（E2E-10/11/12）。

- [ ] T023 [US4] 右键菜单框架与动作合并（类型所有者 actions + registerNodeActions 扩展，按 order 排序） `file: packages/dsh-workspace-canvas/src/client/canvas/menu.ts` `function: ContextMenu / mergeActions` `calls: registry 动作注册表` `verify: 单测：内置+扩展动作合并且排序正确；右键弹出菜单、点空白关闭`
- [ ] T024 [US4] 工作区内置动作（进入 / 重命名 / 删除（级联确认，列出成员数）/ 归档会话） `file: packages/dsh-workspace-canvas/src/client/canvas/menu.ts` `function: workspaceActions` `calls: workspaces.startSession / rename / delete / archiveSession` `verify: 单测：删除含成员工作区 → 确认框列出成员数 → 确认后级联清理 + 调用官方 delete；E2E-11 通过`
- [ ] T025 [US4] US4 集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us4.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us4 测试全绿；quickstart E2E-10/11/12 逐条通过并记录`

---

## Phase 7: User Story 5 - 节点/工作区明细面板（Priority: P2）

**Goal**: 点击右侧弹出明细；工作区明细 = 基础信息 + 会话数（不列条目，clarify Q2）；扩展区块合并。
**Independent Test**: 点击工作区 → 明细；注册区块 → 按序追加（E2E-13/14/15）。

- [ ] T026 [US5] 明细面板框架与区块合并（类型所有者 detail + registerNodeDetailSection 扩展，按 order 渲染） `file: packages/dsh-workspace-canvas/src/client/canvas/detail/panel.tsx` `function: DetailPanel / mergeSections` `calls: registry 明细注册表` `verify: 单测：点击节点弹出面板；内置+扩展区块按序渲染；点空白/关闭收起`
- [ ] T027 [US5] 工作区明细内容（标题/路径/会话数/最近活跃 + 跳转侧边栏入口；不含条目列表） `file: packages/dsh-workspace-canvas/src/client/canvas/detail/workspace-detail.tsx` `function: WorkspaceDetail` `calls: workspaces feed（会话数）` `verify: 单测：明细字段齐全且无会话条目列表；跳转入口触发侧边栏会话列表定位`
- [ ] T028 [US5] US5 集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us5.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us5 测试全绿；quickstart E2E-13/14/15 逐条通过并记录`

---

## Phase 8: User Story 6 - 面板互斥（Priority: P2）

**Goal**: 画布与 dsh-hello 测试面板互斥（后写者胜），协议已在 T005 接入，本阶段完成对方面板与端到端验证。
**Independent Test**: 画布↔测试面板互斥让位（E2E-16/17）。

- [ ] T029 [US6] dsh-hello 测试面板（参与互斥协议的简单中间区域面板，面板名 hello-panel） `file: packages/dsh-hello/src/client/panel.tsx` `function: HelloPanel / mountHelloPanel` `calls: @hundun/dsh-panel-protocol activate / onOtherActivate` `verify: E2E-16/17：画布打开时打开 hello 面板 → 画布让位；反之亦然；标记值始终唯一`
- [ ] T030 [US6] 互斥完整性测试（dispose 清理标记/监听；并发激活后写者胜；刷新后状态收敛） `file: packages/dsh-workspace-canvas/tests/us6.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us6 测试全绿；卸载后 documentElement 无残留 data-dsh-panel-active`

---

## Phase 9: User Story 7 - 设置项：画布开关（Priority: P3）

**Goal**: 「hundun-dsh」设置页（多栏目骨架）+ 画布栏目开关；关闭立即生效（clarify Q1）。
**Independent Test**: 设置页出现画布栏目；开关关闭 → 立即消失；重开恢复（E2E-18/19）。

- [ ] T031 [US7] dsh-all 设置页骨架（注册 settings.section「hundun-dsh」+ 声明子槽位 hundun.settings.item） `file: packages/dsh-all/src/client/index.ts` `function: registerHundunSettingsPage` `calls: ctx.slots.register（settings.section）/ ctx.provide 子槽位声明` `verify: E2E-18 前置：设置面板出现「hundun-dsh」页且栏目区可注册`
- [ ] T032 [US7] 画布设置栏目（enabled 开关，绑定 hundun.canvas 命名空间） `file: packages/dsh-workspace-canvas/src/client/settings.ts` `function: CanvasSettingsCard` `calls: settingsScope.bind('hundun.canvas') / slots.register('hundun.settings.item')` `verify: 单测：栏目渲染含开关；切换值写入设置命名空间`
- [ ] T033 [US7] 开关双半区实时联动（enabled=false：入口/画布立即卸载 + 公告移除；true：恢复且布局保留） `file: packages/dsh-workspace-canvas/src/client/index.ts` `function: onEnabledChange` `calls: 无（订阅 settingsScope）` `verify: E2E-18/19：画布打开时关闭开关 → 画布立即关闭；重开 → 恢复且布局保留`
- [ ] T034 [US7] US7 集成测试 + E2E 验证 `file: packages/dsh-workspace-canvas/tests/us7.spec.ts` `function: 无（测试）` `calls: vitest` `verify: us7 测试全绿；quickstart E2E-18/19 逐条通过并记录`

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 健壮性兜底与全量回归（章程 IV 门禁）。

- [ ] T035 CanvasView 错误边界（渲染抛错 → 兜底提示不白屏） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: CanvasErrorBoundary` `calls: 无` `verify: 单测：子组件抛错时显示兜底而非白屏；错误后可重试`
- [ ] T036 生命周期完整性回归（dispose：移除样式/容器/观察器/监听/标记；双半区卸载无残留） `file: packages/dsh-workspace-canvas/src/client/canvas/controller.ts` `function: CanvasController.dispose` `calls: 无` `verify: 单测：dispose 后 DOM 无注入样式/容器、无 data-dsh-panel-active、观察器已断开`
- [ ] T037 全量回归与 E2E 门禁（全仓 typecheck/test/build + quickstart 25 条场景逐条记录） `file: specs/001-canvas-orchestration/quickstart.md` `function: 无（回归）` `calls: pnpm -r typecheck / test / build` `verify: quickstart.md 场景逐条通过并记录（E2E-08/09 标注待 P1.4 手势；E2E-20 属 P2 未来阶段）；未过场景对应任务 [X] 回退并追加 Convergence`

---

## Dependencies（用户故事完成顺序）

```text
Phase 1/2（Setup + Foundational：T001-T010）── 全部完成才可开工 US
  ├─► US1（T011-T014）        ← 依赖 T003/T006/T007
  ├─► US2（T015-T017）        ← 依赖 T008
  ├─► US3（T018-T022）        ← 依赖 T008/T009（T021 依赖 dsh-hello 已有包）
  ├─► US4（T023-T025）        ← 依赖 T009/T011
  ├─► US5（T026-T028）        ← 依赖 T009
  ├─► US6（T029-T030）        ← 依赖 T001/T002/T005
  └─► US7（T031-T034）        ← 依赖 T004/T010
US 相互独立，Foundational 完成后可并行；Phase 10（T035-T037）最后。
```

**并行机会**：T001-T004（Setup 四包并行）；Foundational 完成后 US1-US7 各阶段内部 [P] 任务可并行
（同一阶段内不同文件任务）；T029 与 T031 无依赖可并行。

## Implementation Strategy（MVP 优先）

- **MVP = US1（Phase 3）**：完成「总览 + 进入 + 稳定挂载」即可独立交付（对应既有 P0 功能 + 稳定性改造），
  其余 US 为增量；
- 增量顺序：US2（持久化，修复 P0 最大缺陷）→ US3（平台）→ US4/US5（管理/明细）→ US6/US7（互斥/设置，依赖前置基础件）；
- 每个 Phase 完成后运行 `$speckit-converge` 对照 spec 检查缺口（章程 V 条），不等到全部完成；
- E2E 门禁：quickstart.md 逐条记录（章程 IV 条）；E2E-08/09（拖线）标注待 P1.4 手势租户。
