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

## 单插件包结构（模板见 templates/plugin，示例见 packages/dsh-workspace-canvas）

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
  - ../dsh-workspace-canvas  # 贡献其 cordis.patch.yml 的 insert 行
deps:
  - ../dsh-workspace-canvas  # 写入聚合包 dependencies: workspace:*
```

`node scripts/aggregate.mjs` 扫描 `packages/*` 下带 `aggregate.yml` 的包，重写其
`cordis.patch.yml` 与 package.json dependencies（其余字段保留）。

## 共享预设来源

`shared/tsdown.client.ts` / `shared/web-platform.ts` 派生自 Apache-2.0 开源的 DSH 官方
client 构建（派生声明见 LICENSE）。改动前先理解：它产出 `window.__ModuleLoader__.load`
闭包工厂产物，CSS Modules 内联注入，并带客户端 bundle 纯度门。改坏它 = 全仓客户端全部构建失败。

## 测试与验证约定

1. **TDD 必声明**：每个功能 `spec.md` MUST 含 `**TDD**: true`（模板已内置）；据此 MUST
   生成 Contract test 与 Integration test 任务，测试任务缺失 = 实现任务不完整。
2. **`[X]` 的唯一依据是运行时行为**：`verify` 字段声明的行为真实通过才可勾选。
   `verify: tsc 通过` / `verify: build 成功` / `verify: 代码已实现` 一律无效——「代码写了」≠「功能完成了」。
3. **E2E 验证门禁**：implement 完成后 MUST 执行本功能 `quickstart.md` 的全部端到端场景，
   逐条记录通过/失败，不得跳过。场景 checkbox 与任务 checkbox 同等约束力：场景未全通过 →
   对应任务 `[X]` 改回 `[ ]` + 追加 Convergence 任务。
4. **阶段收敛**：每个 Phase 完成后 SHOULD 运行 `$speckit-converge` 对比代码 vs spec 缺口。
5. **任务四字段格式**（`tasks.md` 全任务 MUST）：

   ```text
   - [ ] T### [P?] [USx?] 描述 `file: 文件路径` `function: 函数/组件名` `calls: API/函数调用` `verify: 运行时可验证行为`
   ```

   `file` / `function` / `calls` / `verify` 全必填（`calls` 无则填「无」）；缺字段或 verify 为编译/构建类
   声明 → 任务无效。

6. **Proxy 注入保护**：Cordis 的 `ctx` 是 Proxy——访问未在插件 `inject` 声明中的服务属性会直接抛
   `cannot get property "X" without inject`（可选链无法捕获）。新增任何 `ctx.<service>` 访问 MUST
   同步声明 inject；可选服务读取 MUST try/catch 兜底并附模拟 Proxy getter 抛错的回归测试；涉及
   运行时服务的行为 MUST 在真实 DSH web profile 下验证（单测 mock 无 Proxy 保护，全过 ≠ 真机可用）。
