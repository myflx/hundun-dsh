# Implementation Plan: 编排画布（Canvas Orchestration）

**Branch**: `001-canvas-orchestration` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-canvas-orchestration/spec.md`

> 依据：spec.md（含 4 项 clarify 结论）+ `packages/dsh-workspace-canvas/docs/` 四份定稿设计文档 +
> 项目章程 v1.0.0。本计划面向**当前阶段（P0.5 + P1）**；US8 缩放平移（P2）不在本计划实现范围。

## Summary

在聚合仓库中实现「编排画布」：以现有 `dsh-workspace-canvas` 插件为载体，先把 P0 代码对齐定稿设计
（单标记互斥、配置语义、防重复挂载、挂载监督器、单测），再落地 P1 协议骨架（CanvasDocument v1
像素坐标 + workspaceId 归属、`ctx.canvas` 注册服务、工作区节点投影与分区渲染、可扩展右键菜单与右侧
明细面板）；由 `dsh-all` 提供「hundun-dsh」设置页骨架，画布注册「画布」栏目（enabled 开关，双半区
实时生效）；新增共享包 `@hundun/dsh-panel-protocol` 统一面板互斥协议。连线交互框架（FR-009 实施）
按设计门槛**待第三方节点类型租户确认后启动**，本计划只落协议 API 与校验，不落拖线手势。

## Technical Context

**Language/Version**: TypeScript ~5.7.2（monorepo 既有）；宿主 Node ≥22（ESM），浏览器 ES2022+（CJS bundle）

**Primary Dependencies**:
- `@deepseek-ai/cordis` ^4.0.1（双半区插件框架，运行时由 DSH profile 树解析，仅 devDep + external）
- 客户端 SDK（类型/服务）：`dsh-client-runtime` / `dsh-client-connection` / `dsh-client-ui-slots` /
  `dsh-client-ui-sidebar` / `dsh-client-ui-settings`（设置面）@0.1.0-rc.6
- `@deepseek-ai/dsh-settings`（宿主侧 installSettingsSection 联动）@0.1.0-rc.6
- React 18（客户端 UI）+ `@deepseek-ai/dsh-client-ui-primitives`（Tooltip 等平台模块）
- `schemastery`（配置 schema）；`tsdown` 0.22.x + 共享预设 `shared/tsdown.client.ts`（构建）
- 无新增运行时依赖；新增 workspace 包 `@hundun/dsh-panel-protocol`（纯常量/工具，内联进各消费者 bundle）

**Storage**: 浏览器 `localStorage['dsh.workspaceCanvas.doc.v1']`（CanvasDocument v1，500ms 防抖写 +
`.bak` 损坏备份 + `migrate()` 迁移链）；设置走官方 settings 命名空间（`hundun.canvas`）

**Testing**: vitest（单测 + Contract test + Integration test，jsdom）；E2E 走 quickstart.md 人工/GUI 验证
（DSH web profile，HMR）。TDD：spec 已声明 `**TDD**: true`，tasks 阶段 MUST 生成 Contract/Integration 测试任务

**Target Platform**: DSH web GUI（浏览器半区）+ DSH 宿主进程（宿主半区）；Windows 本机

**Project Type**: DSH 双半区插件（cordis 插件包），pnpm workspace monorepo（聚合项目）

**Performance Goals**: 打开画布首帧 ≤ 1s；拖动卡片帧间隔 < 100ms；工作区 ≤ 100 无感知卡顿（SC-002）

**Constraints**:
- 客户端 bundle 纯度门：浏览器半区只可 import 平台模块表（`shared/web-platform.ts`）与内联安全层；
  SDK 其余仅类型导入；跨插件协作走 cordis 服务或 DOM 协议
- `@deepseek-ai/*` 只进 devDependencies 且列入 `libExternal`（宿主）/ 平台表（客户端），运行时由 profile 树解析
- 中间区域 DOM 接管（`[data-pane="conversation"]`）为结构性代价：选择器集中 + 单一挂载监督器自愈，DSH 升级时纳入回归
- 单用户单浏览器；zoom 0.3–3x；节点 ≤100 用 DOM 渲染（超限降级留 P2 评估）

**Scale/Scope**: 工作区 ≤100；节点 ≤100；单画布单文档；本计划实现 P0.5 + P1（P1.4 拖线手势除外）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 门禁（章程 v1.0.0） | 状态 |
|---|---|
| G1 Test-First：spec 声明 `TDD: true` | ✅ spec.md 含 `**TDD**: true`；tasks 阶段强制 Contract/Integration 测试任务 |
| G2 四字段任务格式 | ✅ 待 tasks 阶段执行（tasks-template 已按四字段更新） |
| G3 运行时可验证完成定义（verify 字段） | ✅ 设计产物与 tasks 生成规则已对齐；实现阶段执行 |
| G4 E2E 验证门禁（quickstart.md 场景） | ✅ quickstart.md 已生成 25 条 E2E 场景（含 clarify 结论） |
| G5 阶段收敛（每 Phase 跑 `$speckit-converge`） | ✅ 计划内显式安排 |

**评估结果**：设计层面全部通过，无违规；进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/001-canvas-orchestration/
├── plan.md              # 本文件（$speckit-plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出（E2E 验证清单）
├── contracts/           # Phase 1 输出（接口契约）
│   ├── canvas-registry.md     # ctx.canvas 服务契约
│   ├── panel-protocol.md      # 面板互斥协议
│   ├── settings.md            # hundun-dsh 设置页契约
│   └── workspace-feed.md      # 官方数据面调用契约
└── tasks.md             # Phase 2 输出（$speckit-tasks，本命令不创建）
```

### Source Code (repository root)

```text
packages/dsh-panel-protocol/          # 新增：共享面板互斥协议（常量 + 工具，纯 client，内联进消费者 bundle）
└── src/index.ts

packages/dsh-workspace-canvas/
├── src/index.ts                      # 宿主半区：公告 + 配置解析（enabled/announceToAgent，设置联动）
└── src/client/
    ├── index.ts                      # 客户端入口：apply-guard + 配置订阅 + 挂载监督器
    ├── search-button.tsx             # 画布入口按钮（自愈）
    ├── settings.ts                   # 画布设置栏目（enabled 开关，settingsScope）
    ├── locales.ts
    └── canvas/
        ├── controller.ts             # 状态机 + 中间区域挂载（单标记互斥）
        ├── mount-supervisor.ts       # 单一挂载监督器（收窄观察范围）
        ├── document.ts               # CanvasDocument v1：存储/校验/迁移（P1.1）
        ├── registry.ts               # ctx.canvas 注册服务（P1.2）
        ├── view/                     # CanvasView 视图：像素坐标 + 分区渲染（P1.3）
        ├── menu.ts                   # 右键菜单 + 动作合并（P1.3）
        └── detail/                   # 右侧明细面板 + 区块合并（P1.3）

packages/dsh-all/
└── src/client/index.ts               # 设置页骨架：settings.section「hundun-dsh」+ 子槽位

packages/dsh-hello/
└── src/client/panel.tsx              # 改造：参与互斥协议的测试面板（互斥验收对方面板，可随意改动）
```

**Structure Decision**: 采用「聚合 monorepo 多包」结构——画布功能集中在 `dsh-workspace-canvas` 双半区；
互斥协议抽独立共享包（设计决策 D4，跨插件零硬编码）；设置页骨架放聚合包 `dsh-all`（设计决策 D10）；
`dsh-hello` 兼任互斥测试面板（clarify Q3）。测试按包内 `tests/` 组织（vitest）。

## Complexity Tracking

> 无宪法违规，本表不填（新增 `dsh-panel-protocol` 包为设计决策 D4，非违规；monorepo 包数量不受章程限制）。
