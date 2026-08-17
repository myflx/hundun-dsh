<!-- Sync Impact Report:
      Version: 1.1.0 → 1.2.0 (MINOR)
      Modified: 无（未重命名既有原则）
      Added:    VII. Proxy-Aware Verification（运行时代理感知验证，新增原则）
      Removed:  无
      TODOs:    无
-->

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

### VI. Extreme Autonomous Resolution（NON-NEGOTIABLE）

遇到问题 MUST 先做极致的解决尝试：复现 → 定位根因 → 修复 → 构建/验证 → 必要时重试不同方案，
在把问题抛给用户之前穷尽所有合理路径（含自主排查代码、检查运行时行为、尝试替代实现）。
**不得把任何问题直接抛给用户**，除非确实无法解决；此时 MUST 给出明确解释：
尝试过什么、失败原因、卡点在哪、需要用户提供什么（决策 / 信息 / 环境）。
「实在无法做到」的判定以已穷尽上述解决路径为准，不得以难度高、不确定、或想省事为由提前上交。

### VII. Proxy-Aware Verification（NON-NEGOTIABLE）

Cordis 的 `ctx` 是 Proxy：访问未在插件 `inject` 声明中的服务属性（如 `ctx.sessions`）时，
属性 getter 会**直接抛错**（`cannot get property "X" without inject`），而非返回 undefined——
因此可选链 `?.` 无法捕获，单元测试用普通 mock 对象（无 Proxy 保护）也**无法暴露**该错误：
测试全过 ≠ 真机可用（已发生真实回归：会话统计上线后点击工作区即崩）。

规则：

- 新增任何 `ctx.<service>` 访问 MUST 同步在插件 `inject` 声明该服务（Cordis 据此等待服务就绪）；
- 对可能缺省服务的读取 MUST 以 try/catch（或等价防御）兜底，且 MUST 附带一个
  模拟 Proxy getter 抛错的回归测试（`new Proxy({}, { get: () => { throw ... } })`）；
- 凡涉及运行时服务（ctx 服务、feed 快照、注入保护）的行为，验证 MUST 包含真实
  DSH web profile 下的交互（含首次渲染路径），不得仅以单元测试通过作为交付依据；
- 单元测试与真机运行时的环境差异（Proxy 注入保护、服务就绪时序、feed 基线）MUST
  在验证计划中显式列出并逐项核对，而非隐式假设两者等价。

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

**Version**: 1.2.0 | **Ratified**: 2026-08-16 | **Last Amended**: 2026-08-17
