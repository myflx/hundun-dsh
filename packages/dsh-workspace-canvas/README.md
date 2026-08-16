# dsh-workspace-canvas

工作区编排画布插件：把全部工作区自动渲染成中间区域的画布（每个工作区 = 一个 scope 小画布）。

- **搜索框按钮**：侧边栏工作区搜索行内注入「画布视图」按钮（DOM 注入 + MutationObserver 自愈，dsh-ssh 先例）；
- **中间区域画布**：DOM 层接管 `[data-pane="conversation"]`，注入样式隐藏对话、显示画布（对话状态保留）；与任务看板 / SSH 面板互斥（复用 `dsh-panel-activate` 事件协议）；
- **自动渲染全部工作区**：官方 workspaces feed（`ctx.workspaces.list`，`ObservableSnapshot`），订阅即实时刷新；每个工作区一张卡片（标题 / 路径 / 会话数），点击卡片 `startSession(workspaceId)` 直接进入该工作区的新会话。

host 半区只做系统提示词公告（沿用 dsh-demo-greeter 模式）。

## 画布设计参考

画布的最终目标是**编排**：**工作区是强制 scope 容器，其它节点不可脱离工作区而存在**；
一个工作区 = 一个区域（scope 小画布），区域内放置 agent 预设 / 任务 / 渠道等节点。
**节点类型与连线规则均可由其它插件经注册协议扩展**（画布只负责定义、编排、展示、存储，
不执行任何业务）。完整文档体系见 [docs/README.md](docs/README.md)：

- [docs/orchestration-design.md](docs/orchestration-design.md) —— 架构设计（概念层：角色分工/数据边界/关系模型/存储/扩展约定）；
- [docs/protocol-spec.md](docs/protocol-spec.md) —— **协议规格（单一事实源）**：CanvasDocument v1 数据模型、`ctx.canvas` 服务、节点/连线规则类型、交互管线、命名/版本/降级约定；
- [docs/implementation-plan.md](docs/implementation-plan.md) —— 落地计划：P0 现状 → P1 协议骨架 → P2 视图布局 → P3 体验面板，含任务清单与验收；
- [docs/capability-boundaries.md](docs/capability-boundaries.md) —— 能力边界与判定准则；
- [docs/design-hundun-canvas.md](docs/design-hundun-canvas.md) —— hundun-web 画布参考（P2 移植来源）。

## 构建

本插件属于 hundun-dsh 聚合 monorepo（`packages/dsh-workspace-canvas`）：

```sh
pnpm -r --filter @hundun/dsh-workspace-canvas build
pnpm -r --filter @hundun/dsh-workspace-canvas typecheck
```

产物：`lib/index.js`（host 半区）+ `lib/client.js`（browser 半区）+ `lib/types/`。

## 安装

```sh
dsh plugin --profile web add link:<本包绝对路径>
```

或经聚合包 `@hundun/dsh-all` 一键装配（见仓库根 README）。

重启 `dsh web` 后：

1. 侧边栏工作区搜索行出现画布图标按钮（点搜索图标展开后可见）；
2. 点击按钮 → 中间区域切换为画布，自动渲染全部工作区；
3. 点击工作区卡片 → 进入该工作区的新会话；
4. 点侧边栏会话/工作区行或「关闭画布」→ 退出画布。

## 卸载

```sh
dsh plugin --profile web remove dsh-workspace-canvas
```

重启后画布入口与画布消失。

## 开发（HMR）

宿主侧 HMR 已在 `~/.dsh/cordis.patch.yml` 打开（`- id: hmr / disabled: false`）。
改 `src/` 代码后，已挂载插件的变更会自动热重载，无需重启；改 `src/client/`
并重新 `pnpm build` 后浏览器侧经 `dsh-client-hmr` 免刷新重载。
