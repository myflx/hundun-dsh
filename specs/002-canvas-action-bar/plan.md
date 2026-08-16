# Implementation Plan: 画布操作栏（Canvas Controls，对齐 hundun-web）

**Branch**: `002-canvas-action-bar` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-canvas-action-bar/spec.md`（v2：缩小/重置/放大/刷新）

## Summary

把右上角独立缩放工具整合为**画布底部操作栏**，按序提供四个按钮——**缩小 / 重置 / 放大 / 刷新**
（对齐 hundun-web `canvas-controls` 工具栏，L1375-1380）：缩小/放大复用既有 view 变换（10% 步进、
0.3–3 夹取）；重置恢复 100% + 原点；刷新调用 workspaces 服务基线重新拉取（`refresh()`），feed 更新后
画布经订阅自动反映最新工作区数据。操作栏复用系统设计令牌（`--dsw-alias-*`），低干扰浮层不拦截画布交互。

## Technical Context

**Language/Version**: TypeScript（浏览器半区，tsdown 闭包工厂 bundle）

**Primary Dependencies**: react；既有 `canvas/view-transform.ts`（zoomAt/panBy/resetView/clampZoom）、
`canvas/CanvasView.tsx`（画布主组件，现有右上角工具栏）；官方服务 `ctx.workspaces`（feed + `refresh()` 基线拉取）；
跨插件协议 `@hundun/dsh-panel-protocol`（面板互斥）

**Storage**: localStorage（`CanvasDocument` v1，view 防抖持久化，既有）

**Testing**: vitest（jsdom 单测）+ playwright（真机 E2E，3080）；TDD 先行

**Target Platform**: DSH web GUI 浏览器半区（`[data-slot="conversation"] > *` 子盒子挂载）

**Project Type**: DSH 插件（`packages/dsh-workspace-canvas` 浏览器半区功能增量）

**Performance Goals**: 操作栏交互即时响应（<100ms）；刷新后画布更新 <1s（feed 驱动）

**Constraints**: 操作栏复用系统设计令牌（无硬编码颜色/圆角/阴影）；不拦截画布拖拽/平移；不占用官方槽位；
刷新失败安全降级；遵循面板互斥协议

**Scale/Scope**: 单用户单浏览器；工作区 ≤100；操作栏 4 个功能项（缩小/重置/放大/刷新）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 条款 | 本计划安排 |
| --- | --- |
| I. Test-First（TDD） | ✅ spec 已声明 `**TDD**: true`；tasks 含 Contract/Integration test（操作栏渲染、按钮行为、刷新调用） |
| II. Runtime-Verifiable DoD | ✅ 每个任务 `verify` 声明可运行时验证行为（单测断言 + playwright 真机断言） |
| III. Four-Field Task Format | ✅ tasks.md 全部任务含 file/function/calls/verify |
| IV. E2E Verification Gate | ✅ quickstart.md 生成 E2E 场景（四按钮/缩放/重置/刷新/UI 一致），implement 后逐条执行记录 |
| V. Phase Convergence | ✅ 每 Phase 末对照 spec 检查缺口 |

**评估结果**：设计层面全部通过，无违规；进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/002-canvas-action-bar/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出（E2E 验证清单）
├── contracts/           # Phase 1 输出（操作栏契约）
└── tasks.md             # Phase 2 输出（$speckit-tasks）
```

### Source Code (repository root)

```text
packages/dsh-workspace-canvas/
├── src/client/canvas/
│   └── CanvasView.tsx           # 操作栏改造：TOOLBAR → ACTION_BAR（底部四按钮）+ handleRefresh
└── tests/
    └── action-bar.spec.ts       # 四按钮渲染/顺序、缩放/重置行为、刷新调用（Integration）
```

**Structure Decision**: 改动集中在 `CanvasView.tsx`（操作栏 JSX + handlers）；刷新直接调
`ctx.workspaces.refresh()`（无新助手文件）；测试对齐既有 `tests/`。

## Complexity Tracking

> 无宪法违规（单一插件内增量，无新增工程/模式）。

## Phase 0/1 输出（另见 research.md / data-model.md / contracts/ / quickstart.md）

- **技术决策**：操作栏为画布内 absolute 浮层（bottom 居中）；四按钮顺序缩小→重置→放大→刷新（hundun-web 对齐）；
  刷新 = `(ctx.workspaces as any).refresh?.()`（IWorkspaces 接口未暴露 refresh，运行时 WorkspaceRuntime 有，
  可选链兜底失败安全降级）；feed 更新驱动画布自动重渲染
- **契约**：`contracts/action-bar.md` 定义操作栏 DOM 标记（`data-dsh-action-bar` /
  `data-dsh-action-zoom-out|reset|zoom-in|refresh`）与行为契约
