# Tasks: 画布底部操作栏（Canvas Action Bar）

**Input**: Design documents from `/specs/002-canvas-action-bar/`

**Prerequisites**: plan.md（技术栈/结构）、spec.md（用户故事与优先级）、data-model.md、contracts/action-bar.md、research.md

**Tests**: spec.md 已声明 `**TDD**: true` —— 每个用户故事阶段 MUST 含 Contract test 与 Integration test 任务（项目章程 I 条）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format（四字段，全必填，项目章程 III 条）

```text
- [ ] T### [P?] [USx?] 描述 `file: 文件路径` `function: 函数/组件名` `calls: API/函数调用` `verify: 运行时可验证行为`
```

## Phase 2: Foundational（基础件：纯函数助手）

**Purpose**: 聚焦/自动布局的算法助手（无 UI 依赖，先行单测）。

- [x] T001 [P] view 聚焦助手 `focusView` 纯函数（平移使 scene 目标居中、zoom 不变） `file: packages/dsh-workspace-canvas/src/client/canvas/view-transform.ts` `function: focusView` `calls: 无` `verify: view-transform.spec +2 条单测：x=w/2-tx*zoom、y=h/2-ty*zoom 且 zoom 保持；纯函数不改入参`
- [x] T002 [P] 自动布局助手 `autoLayoutWorkspaces`（按 feed 顺序 GRID 重排全部工作区，空数组空操作） `file: packages/dsh-workspace-canvas/src/client/canvas/workspace-position.ts` `function: autoLayoutWorkspaces` `calls: autoPosition / commitWorkspacePosition` `verify: workspace-position.spec +2 条单测：3 个工作区按 autoPosition(0..2) 落位且防抖落盘；空数组不 mutate`

## Phase 3: User Story 1 - 底部操作栏整合缩放与视图控制（Priority: P1）

**Goal**: 底部操作栏（缩小/百分比/放大/重置视图）；右上角独立缩放工具移除；UI 与系统一致（FR-001~006）。
**Independent Test**: 打开画布 → 底部出现操作栏、右上角无独立缩放工具；缩放/重置行为正确；操作栏不拦截拖拽（E2E-01~05）。

- [x] T003 [US1] 操作栏渲染与缩放整合：底部浮层（ACTION_BAR_STYLE，复用系统设计令牌）+ 移除右上角独立工具栏 `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: ACTION_BAR_STYLE / 渲染结构（删除 data-dsh-canvas-toolbar 区块，新增 data-dsh-action-bar 区块）` `calls: 无` `verify: action-bar.spec 单测：渲染 [data-dsh-action-bar] 含 −/百分比/+/重置 按钮；DOM 中无 [data-dsh-canvas-toolbar]；样式声明不含硬编码颜色（仅 var(--dsw-alias-*)）`
- [x] T004 [US1] 缩放/重置按钮行为（10% 步进、30%–300% 夹取、百分比实时、重置回 100%+原点） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: zoomBy / resetViewTransform（复用既有）` `calls: view-transform zoomAt / resetView` `verify: action-bar.spec 单测（点击行为）+ playwright 真机：放大 110%→重置 100%、夹取边界；E2E-02/03`

## Phase 4: User Story 2 - 自动布局（Priority: P2）

**Goal**: 操作栏「自动布局」按钮：GRID 重排全部工作区、保留成员相对位置、持久化（FR-007/008/010）。
**Independent Test**: 拖乱卡片 → 点自动布局 → 不重叠对齐网格；刷新保留（E2E-06~09）。

- [x] T005 [US2] 自动布局按钮接入（无工作区禁用；点击批量 GRID 重排并持久化） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: handleAutoLayout / ACTION_BAR 新增 data-dsh-action-layout` `calls: workspace-position autoLayoutWorkspaces` `verify: action-bar.spec 单测（点击触发重排、无工作区禁用）+ playwright 真机：拖乱后一键重排不重叠、刷新保留；E2E-06/07/08/09`

## Phase 5: User Story 3 - 聚焦工作区（Priority: P3）

**Goal**: 操作栏「聚焦」按钮：选择工作区 → 平移居中（zoom 不变）；目标缺失提示且视图不变（FR-009）。
**Independent Test**: 平移到远处 → 聚焦某工作区 → 卡片居中可见、zoom 不变（E2E-10~12）。

- [x] T006 [US3] 聚焦工作区按钮（目标下拉选择 + focusView 应用 + 缺失提示 + 无工作区禁用） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: handleFocus / ACTION_BAR 新增 data-dsh-action-focus（含目标选择弹层）` `calls: view-transform focusView / commitWorkspacePosition（无）` `verify: action-bar.spec 单测（选择目标→view 平移居中且 zoom 不变；无目标禁用）+ playwright 真机：聚焦后卡片完整可见、zoom 保持；E2E-10/11/12`

## Phase 6: Polish（收尾与门禁）

**Purpose**: 全量回归 + E2E 门禁（章程 IV 条）。

- [x] T007 全量回归与 E2E 门禁（全仓 typecheck/test/build + quickstart 15 条场景逐条记录 + UI 一致性静态检查） `file: specs/002-canvas-action-bar/quickstart.md` `function: 无（回归）` `calls: pnpm -r typecheck / test / build` `verify: quickstart.md 场景逐条通过并记录（E2E-01~15）；未过场景对应任务 [X] 回退并追加 Convergence`

## Dependency Graph

```
T001/T002（Foundational，可并行）
  ├─► T003 → T004（US1：操作栏 + 缩放整合）      ← 依赖 T001（focusView 不阻塞，缩放用既有 zoomAt）
  ├─► T005（US2：自动布局）                       ← 依赖 T002
  └─► T006（US3：聚焦）                           ← 依赖 T001
T007（Polish 门禁）                                ← 依赖全部
```

**并行机会**：T001 与 T002 并行（不同文件）；US1/US2/US3 内部任务串行，US 间可并行（CanvasView 同文件
冲突 → 建议按 US1→US2→US3 顺序或合并提交）。

## Implementation Strategy（MVP 优先）

- **MVP = US1（Phase 3）**：底部操作栏 + 缩放整合独立交付（对应 FR-001~006，P1 高频操作）；
- 增量顺序：US2（自动布局，P2）→ US3（聚焦，P3）；
- 每个 Phase 完成后运行 `$speckit-converge` 对照 spec 检查缺口（章程 V 条）；
- E2E 门禁：quickstart.md 逐条记录（章程 IV 条）。
