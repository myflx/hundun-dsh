# Tasks: 画布操作栏（Canvas Controls，对齐 hundun-web）

**Input**: Design documents from `/specs/002-canvas-action-bar/`

**Prerequisites**: plan.md（技术栈/结构）、spec.md（用户故事与优先级）、data-model.md、contracts/action-bar.md、research.md

**Tests**: spec.md 已声明 `**TDD**: true` —— 每个用户故事阶段 MUST 含 Contract test 与 Integration test 任务（项目章程 I 条）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format（四字段，全必填，项目章程 III 条）

```text
- [ ] T### [P?] [USx?] 描述 `file: 文件路径` `function: 函数/组件名` `calls: API/函数调用` `verify: 运行时可验证行为`
```

## Phase 3: User Story 1 - 画布操作栏（缩小/重置/放大/刷新，Priority: P1）

**Goal**: 底部操作栏四按钮（顺序对齐 hundun-web：缩小→重置→放大→刷新）；右上角独立缩放工具移除；
刷新重新拉取工作区基线；UI 与系统一致（FR-001~007）。
**Independent Test**: 打开画布 → 底部操作栏四按钮按序 → 右上角无独立缩放工具；缩放/重置行为正确；
刷新触发数据更新；操作栏不拦截拖拽（E2E-01~06）。

- [x] T001 [US1] 操作栏渲染：底部四按钮（缩小/重置/放大/刷新，hundun-web 顺序）+ 移除右上角独立工具栏 `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: ACTION_BAR_STYLE / 渲染结构（删除 data-dsh-canvas-toolbar 区块，新增 data-dsh-action-bar 四按钮）` `calls: 无` `verify: action-bar.spec 单测：渲染 [data-dsh-action-bar] 且按钮顺序为 zoom-out → reset → zoom-in → refresh；DOM 中无 [data-dsh-canvas-toolbar]；样式声明不含硬编码颜色（仅 var(--dsw-alias-*)）`
- [x] T002 [US1] 缩小/放大/重置按钮行为（10% 步进、30%–300% 夹取、百分比实时、重置回 100%+原点） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: zoomBy / resetViewTransform（复用既有）` `calls: view-transform zoomAt / resetView` `verify: action-bar.spec 单测（点击行为）+ playwright 真机：放大 110%→重置 100%、夹取边界；E2E-02/03`
- [x] T003 [US1] 刷新按钮行为（调用 workspaces 基线重新拉取；失败安全降级） `file: packages/dsh-workspace-canvas/src/client/canvas/CanvasView.tsx` `function: handleRefresh` `calls: ctx.workspaces.refresh()` `verify: action-bar.spec 单测：点击刷新调用 workspaces.refresh 一次；无 workspaces/refresh 缺失时不抛错（可选链兜底）；playwright 真机：刷新后画布数据随 feed 更新；E2E-04/05`

## Phase 6: Polish（收尾与门禁）

**Purpose**: 全量回归 + E2E 门禁（章程 IV 条）。

- [x] T004 全量回归与 E2E 门禁（全仓 typecheck/test/build + quickstart 场景逐条记录 + UI 一致性静态检查） `file: specs/002-canvas-action-bar/quickstart.md` `function: 无（回归）` `calls: pnpm -r typecheck / test / build` `verify: quickstart.md 场景逐条通过并记录；未过场景对应任务 [X] 回退并追加 Convergence`

## Dependency Graph

```
T001（操作栏渲染）→ T002（缩放/重置）→ T003（刷新）
T004（门禁）← 全部
```

**并行机会**：T001 与 T002 涉及同文件（CanvasView）建议串行；T003 依赖 T001 的操作栏结构。

## Implementation Strategy（MVP 优先）

- **MVP = 全部（单 US）**：四按钮操作栏一次交付（用户明确指定的操作集合）；
- 每个 Phase 完成后运行 `$speckit-converge` 对照 spec 检查缺口（章程 V 条）；
- E2E 门禁：quickstart.md 逐条记录（章程 IV 条）。
