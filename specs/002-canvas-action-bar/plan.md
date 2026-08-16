# Implementation Plan: 画布底部操作栏（Canvas Action Bar）

**Branch**: `002-canvas-action-bar` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-canvas-action-bar/spec.md`

## Summary

在 `dsh-workspace-canvas` 浏览器半区把右上角独立缩放工具整合为**画布底部操作栏**（缩小 / 百分比 / 放大 / 重置视图），并新增「自动布局」（GRID 重排全部工作区、保留成员相对位置、持久化）与「聚焦工作区」（平移使目标居中、缩放不变）两个操作按钮；操作栏复用系统设计令牌（`--dsw-alias-*`），与系统控件视觉一致，低干扰浮层不拦截画布交互。

## Technical Context

**Language/Version**: TypeScript（浏览器半区，tsdown 闭包工厂 bundle，无 TS 转译外的框架）

**Primary Dependencies**: react（客户端渲染）；既有内部模块 `canvas/view-transform.ts`（ViewTransform/zoomAt/panBy/resetView）、`canvas/document.ts`（CanvasDocumentStore + view/position 持久化）、`canvas/CanvasView.tsx`（画布主组件，现有右上角工具栏）；官方服务 `ctx.workspaces.list`（feed）；跨插件协议 `@hundun/dsh-panel-protocol`（面板互斥）

**Storage**: localStorage（`CanvasDocument` v1，key `dsh.workspaceCanvas.doc.v1`；view 与 workspace 节点 position 已持久化，防抖写入）

**Testing**: vitest（单测，jsdom）+ playwright（真机 E2E，驱动 `http://127.0.0.1:3080`）；TDD 先行

**Target Platform**: DSH web GUI 浏览器半区（现行 shell：`[data-slot="conversation"] > *` 子盒子挂载）

**Project Type**: DSH 插件（`packages/dsh-workspace-canvas` 浏览器半区功能增量）

**Performance Goals**: 操作栏交互即时响应（<100ms 感知）；自动布局对 ≤100 工作区 <200ms；聚焦平移即时

**Constraints**: 操作栏复用系统设计令牌（无硬编码颜色/圆角/阴影）；不拦截画布拖拽/平移；不占用官方槽位（画布内浮层）；遵循面板互斥协议

**Scale/Scope**: 单用户单浏览器；工作区 ≤100（DOM 渲染既有上限）；操作栏 3 个功能点（缩放整合 / 自动布局 / 聚焦）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 条款 | 本计划安排 |
| --- | --- |
| I. Test-First（TDD） | ✅ spec 已声明 `**TDD**: true`；tasks 将按 US 生成 Contract test + Integration test（view 变换聚焦助手、布局助手、操作栏渲染） |
| II. Runtime-Verifiable DoD | ✅ 每个任务 `verify` 声明可运行时验证行为（单测断言 + playwright 真机断言） |
| III. Four-Field Task Format | ✅ tasks.md 全部任务含 file/function/calls/verify |
| IV. E2E Verification Gate | ✅ quickstart.md 生成 E2E 场景（操作栏/缩放整合/自动布局/聚焦/UI 一致），implement 后逐条执行记录 |
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
│   ├── CanvasView.tsx           # 操作栏改造：TOOLBAR → ACTION_BAR（底部）、自动布局/聚焦按钮
│   ├── view-transform.ts        # + focusView（聚焦平移助手）
│   └── workspace-position.ts    # + autoLayoutWorkspaces（GRID 重排助手，或复用 autoPosition）
└── tests/
    ├── action-bar.spec.ts       # 操作栏渲染/缩放整合/自动布局/聚焦（Integration）
    ├── view-transform.spec.ts   # + focusView 单测（Contract）
    └── workspace-position.spec.ts # + 自动布局单测（Contract）
```

**Structure Decision**: 全部改动落在既有 `CanvasView.tsx` 与两个纯函数助手文件（`view-transform.ts` / `workspace-position.ts`），无新文件层级；测试对齐既有 `tests/` 目录（vitest）。

## Complexity Tracking

> 无宪法违规（单一插件内增量，无新增工程/模式）。

## Phase 0/1 输出（另见 research.md / data-model.md / contracts/ / quickstart.md）

- **技术决策**：操作栏为画布内 absolute 浮层（bottom 定位），复用现有 `--dsw-alias-*` 令牌；聚焦用 `focusView(view, center, zoom)` 纯函数（平移使 scene 目标居中）；自动布局复用 `autoPosition(index)` GRID 步进批量提交 `commitWorkspacePosition`
- **契约**：`contracts/action-bar.md` 定义操作栏 DOM 标记（`data-dsh-action-bar` / `data-dsh-action-zoom-in|out|reset|layout|focus`）与行为契约，供单测与 E2E 引用
