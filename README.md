# hundun-dsh

聚合的 DeepSeek Harness (DSH) 插件 monorepo：每个插件是一个符合官方标准的独立可安装 npm 包（宿主半区 + 浏览器半区），聚合包 `dsh-all` 一键装配全部插件。

> 项目骨架：pnpm workspace + tsdown 双半区构建 + 聚合补丁生成器。当前处于初始化阶段，具体功能插件待逐一生效。

## 结构

```
hundun-dsh/
├── package.json            # 根：workspace 脚本（build / test / typecheck / aggregate）
├── pnpm-workspace.yaml     # shared + packages/*
├── shared/                 # 共享构建预设（客户端 bundle 的 tsdown preset，全仓唯一事实源）
├── scripts/
│   ├── aggregate.mjs       # 聚合补丁生成器：aggregate.yml → cordis.patch.yml + workspace 依赖
│   └── plugin-new.mjs      # 新插件脚手架：templates/plugin → packages/dsh-<name>
├── templates/plugin/       # 插件包模板（宿主工具 + 客户端槽位 UI 的完整最小示例）
└── packages/
    ├── dsh-hello/          # 示例插件：宿主问候工具 + 侧边栏问候按钮
    └── dsh-all/            # 聚合载包：dependencies 以 workspace:* 引用全部插件，
                            #   cordis.patch.yml 为各子插件 insert 行的拼接
```

## 快速开始

```bash
pnpm install
pnpm -r build       # 各插件 tsc 类型产物 + tsdown 双半区 bundle
pnpm -r typecheck
pnpm -r test
node scripts/aggregate.mjs --check   # 校验聚合补丁与依赖未漂移
```

## 新增一个插件

```bash
node scripts/plugin-new.mjs my-feature --description "一句话说明"
# 生成 packages/dsh-my-feature，宿主问候工具 + 侧边栏入口的完整可构建骨架
pnpm install         # 链接新 workspace 包
node scripts/aggregate.mjs   # 把新插件并入聚合包 dsh-all
```

## 安装到 DSH

插件经 `dsh.bundle.patch`（`cordis.patch.yml`）注入 profile 组合。两种方式：

- 单个插件：`dsh plugin --profile <name> add link:<repo>/packages/dsh-<name>`
- 聚合一键：把 `@hundun/dsh-all` 作为依赖装入 profile 树，其 patch 会插入全部子插件行

## 约定

- **包命名**：`@hundun/dsh-<name>`，目录 `packages/dsh-<name>`；插件行 id 用 `hundun-<name>`。
- **双半区**：`src/index.ts`（宿主，Node 进程）+ `src/client/index.ts`（浏览器，Web GUI）。
- **SDK 依赖**：`@deepseek-ai/*` 一律为 devDependency + tsdown external，运行时由 DSH profile 树解析，不随包发布。
- **生成文件勿手改**：`packages/*/cordis.patch.yml` 与聚合包 package.json 的 dependencies 由 `scripts/aggregate.mjs` 生成，改 `aggregate.yml` 后重跑。
- **客户端 bundle 纯度**：浏览器半区只能 import 平台模块表（react、slots 等）与内联安全层；跨插件值导入一律报错，协作走 cordis 服务。

## 许可

Apache-2.0。`shared/tsdown.client.ts` 与 `shared/web-platform.ts` 派生自
[dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（Apache-2.0，其源出 DeepSeek Harness 官方 client 构建）。
