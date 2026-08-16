# hundun-dsh Constitution

<!-- 项目章程：speckit 工作流的非协商权威。speckit-analyze / speckit-converge 以本文为准：
     与本文冲突 = CRITICAL。修订需文档化并经用户批准。 -->

## Core Principles

### I. Test-First（NON-NEGOTIABLE）

每个功能 `spec.md` MUST 声明 **`TDD`: true**。`speckit-tasks` 据此 MUST 生成 Contract test 与
Integration test 任务（与实现任务同批）。测试与实现同步编写——没有对应测试任务的实现任务不完整。

### II. Runtime-Verifiable Definition of Done

`tasks.md` 中任务标记 `[X]` 的**唯一**依据是 `verify` 字段的运行时可验证行为真实通过。
`tsc 通过`、`build 成功`、`代码已实现` 一律**不构成**完成证据——「代码写了」不等于「功能完成了」。

### III. Four-Field Task Format

`tasks.md` 的每个任务 MUST 携带四个字段：`file` / `function` / `calls` / `verify`（全必填；
`calls` 无调用时填「无」）。缺任意字段的任务无效、不可独立验证；`speckit-tasks` MUST 按此格式生成。

### IV. E2E Verification Gate

所有 speckit 功能开发 MUST 在 implement 完成后执行该功能 `quickstart.md` 的端到端验证场景，
逐条记录通过/失败，不得跳过。**`quickstart.md` 场景 checkbox 与 `tasks.md` 任务 checkbox 同等约束力**：
场景未全部通过时，对应任务的 `[X]` 标记无效，MUST 改回 `[ ]` 并追加 Convergence 任务。

### V. Phase Convergence

每个 Phase 完成后 SHOULD 运行 `$speckit-converge`，对比代码 vs spec/plan/tasks 的缺口——
早收敛，不等到全部任务标记完成才对比。

## Additional Constraints

- `[P]` 并发标记仅用于无文件/依赖冲突的任务（不同文件、无依赖）；
- 验证环境为本机（Windows / DSH web profile，HMR 开启）；E2E 场景以 GUI 实际交互为准，
  脚本类验证以真实进程/服务输出为准；
- 特征目录约定：`spec.md` / `plan.md` / `tasks.md` 等按特征存于 `specs/<NNN>-<name>/`（`speckit-specify`
  默认目录），`.specify/feature.json` 持久化当前特征路径（本机状态，不入库）。

## Development Workflow & Quality Gates

- 任务状态流转：实现 → 运行 `verify` 声明的运行时行为 → 通过才标 `[X]`；
- E2E 验证：每个 Phase 末与全部任务完成后各跑一次 quickstart.md 场景并记录结果；
- 任何 `[X]` 因场景未过被撤销（回退 `[ ]`）时，MUST 立即追加 Convergence 任务（由 `$speckit-converge` 生成）。

## Governance

- 本宪法优先于其他惯例；修订需文档化（版本递增 + 修订说明）并经用户批准；
- 工作流细则与字段示例见仓库 `AGENTS.md`「speckit 测试与验证约定」；
- 与宪法冲突的 spec / plan / tasks 内容视为 CRITICAL，须调整文档而非稀释原则。

**Version**: 1.0.0 | **Ratified**: 2026-08-16 | **Last Amended**: 2026-08-16
