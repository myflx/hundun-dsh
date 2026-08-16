# AGENTS.md — hundun-dsh 协作约定

本文件是给在此仓库工作的 agent（含未来的你）看的。动手前先读。

## 仓库是什么

聚合的 DSH 插件 monorepo。每个 `packages/dsh-*` 是一个独立可安装的插件 npm 包（宿主半区 + 浏览器半区），
`packages/dsh-all` 是聚合载包：以 `workspace:*` 依赖全部插件，其 `cordis.patch.yml` 拼接所有子插件的 insert 行，
DSH profile 树按 `dsh.bundle.patch` 加载该补丁即可一键装配。

## 常用命令

```bash
pnpm install                 # 首次或新增依赖后
pnpm -r build                # 全仓构建（tsc 类型产物 + tsdown bundle）
pnpm -r typecheck            # tsc --noEmit
pnpm -r test                 # vitest run（各包）
node scripts/aggregate.mjs   # 重生成聚合补丁与聚合包 dependencies
node scripts/aggregate.mjs --check   # 校验未漂移（CI 用）
node scripts/plugin-new.mjs <name> --description "..."   # 脚手架新插件
```

## 单插件包结构（以 dsh-hello 为模板）

```
packages/dsh-<name>/
├── package.json        # name: @hundun/dsh-<name>; dsh.bundle.patch → ./cordis.patch.yml
│                       # dsh.client: { inject: [...], platform: "web" }
├── cordis.patch.yml    # 手写，仅一行 - insert: [{ id: hundun-<name>, name: '<pkg>' }]
├── tsconfig.json       # 检查用（noEmit）；tsconfig.build.json 发声明到 lib/types
├── tsdown.config.ts    # 复用 shared/tsdown.client.ts 的 clientBundle() 预设
├── vitest.config.ts
└── src/
    ├── index.ts        # 宿主半区：注入服务 + 注册工具/systemPrompt 段落
    └── client/index.ts # 浏览器半区：注入 slots 等，slots.inject + slots.register 挂 UI
```

## 硬性约定（违反会红）

1. **生成文件勿手改**：`packages/*/cordis.patch.yml`（聚合包那份）与聚合包 package.json 的 dependencies 由
   `scripts/aggregate.mjs` 生成。改 `aggregate.yml`（patchFrom / deps / self）后重跑脚本。单插件自己的
   `cordis.patch.yml` 是手写的，可改。
2. **SDK 依赖规则**：`@deepseek-ai/*` 只能进 devDependencies，且必须列入该包 tsdown 配置的
   `libExternal`（宿主）或留在平台模块表（客户端）。运行时由 DSH profile 树解析，随包安装会重复实例。
3. **客户端 bundle 纯度**：浏览器半区只能 import 平台模块（react、`@deepseek-ai/dsh-client-ui-slots` 等，见
   `shared/web-platform.ts`）与内联安全层；其余 `@deepseek-ai/*` 值导入是构建错误。跨插件协作走 cordis 服务，
   不要跨包值导入。类型导入（`import type`）会被擦除，不受限。
4. **客户端失败策略**：DOM 挂载问题只 log 不 throw —— Web shell 在 apply 抛错时会整体启动失败，外部插件不得拖垮 GUI。
5. **生命周期**：宿主/客户端注册都要绑定到 ctx 的 fiber（`ctx.effect` / `ctx.slots.inject` 的 disposer），
   卸载时全部回收；热重载/重挂载不得留下重复挂载（可参考 apply-guard 模式）。
6. **样式**：客户端用 CSS Modules（`*.module.css`），由共享预设内联为 `<style data-plugin>`；不要用全局 class。

## 聚合流程

`packages/dsh-all/aggregate.yml`：

```yaml
patchFrom:
  - ../dsh-hello        # 贡献其 cordis.patch.yml 的 insert 行
deps:
  - ../dsh-hello        # 写入聚合包 dependencies: workspace:*
```

`node scripts/aggregate.mjs` 扫描 `packages/*` 下带 `aggregate.yml` 的包，重写其
`cordis.patch.yml` 与 package.json dependencies（其余字段保留）。

## 共享预设来源

`shared/tsdown.client.ts` / `shared/web-platform.ts` 派生自 dsh-web-ui（Apache-2.0，其源出 DeepSeek Harness
官方 client 构建）。改动前先理解：它产出 `window.__ModuleLoader__.load` 闭包工厂产物，CSS Modules 内联注入，
并带客户端 bundle 纯度门。改坏它 = 全仓客户端全部构建失败。

## speckit 工作流（已项目级安装）

本仓库已安装 spec-kit 技能与脚手架（参考 myflx-home/hundun-desktop 的 0.16.1 结构）：

- **技能**：`speckit-*` 共 10 个，位于 `.dsh/skills/`（DSH 项目技能根，跟随仓库分发）；用户级副本在
  `~/.dsh/skills/`。技能目录由 DSH 自动扫描，无需额外配置。
- **脚手架**：`.specify/`（scripts / templates / memory / integrations / workflows），由技能按需调用：
  - 工作产物约定：`spec.md` / `plan.md` / `tasks.md` / `quickstart.md` 按特征存于 `specs/<NNN>-<name>/`
    （`speckit-specify` 默认目录；`.specify/feature.json` 持久化当前特征路径，属本机状态不入库）；
  - `memory/constitution.md` = 项目章程（**已 ratify v1.0.0**，speckit 工作流的非协商权威）；
  - 扩展钩子：`.specify/extensions.yml`（当前不存在，技能会静默跳过）。
- **工作流顺序**：specify → clarify → plan → tasks → analyze → implement → converge；checklist / constitution /
  taskstoissues 按需。PowerShell 脚本为本机（Windows）路径。
- 注意：speckit CLI 未安装；脚手架是拷贝自参考项目的官方骨架，将来装了 CLI 可 `speckit init` 重新生成。

## speckit 测试与验证约定（项目章程条款）

> 完整条款见 `.specify/memory/constitution.md`（v1.0.0）。以下为执行要点，违反即红：

1. **TDD 必声明**：每个功能 `spec.md` MUST 含 `**TDD**: true`（模板已内置）；`speckit-tasks` 据此 MUST
   生成 Contract test 与 Integration test 任务，测试任务缺失 = 实现任务不完整。
2. **`[X]` 的唯一依据是运行时行为**：`verify` 字段声明的行为真实通过才可勾选。
   `verify: tsc 通过` / `verify: build 成功` / `verify: 代码已实现` 一律无效——「代码写了」≠「功能完成了」。
3. **E2E 验证门禁**：implement 完成后 MUST 执行本功能 `quickstart.md` 的全部端到端场景，逐条记录通过/失败，
   不得跳过。场景 checkbox 与任务 checkbox 同等约束力：场景未全通过 → 对应任务 `[X]` 改回 `[ ]` +
   追加 Convergence 任务。
4. **阶段收敛**：每个 Phase 完成后 SHOULD 运行 `$speckit-converge` 对比代码 vs spec 缺口，不等到全部完成。
5. **任务四字段格式**（`tasks.md` 全任务 MUST）：

   ```text
   - [ ] T### [P?] [USx?] 描述 `file: 文件路径` `function: 函数/组件名` `calls: API/函数调用` `verify: 运行时可验证行为`
   ```

   `file` / `function` / `calls` / `verify` 全必填（`calls` 无则填「无」）；缺字段或 verify 为编译/构建类
   声明 → 任务无效。
