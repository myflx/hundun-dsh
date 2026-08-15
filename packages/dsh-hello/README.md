# dsh-hello

hundun-dsh 示例插件：宿主问候工具 + 侧边栏问候按钮（模板产物）

hundun-dsh 聚合项目中的示例插件（脚手架模板产物）。演示标准插件包的两个扩展面：

- **宿主半区**（`src/index.ts`）：system-prompt 段落声明插件存在；`hello_greet` 模型工具返回问候语。
- **浏览器半区**（`src/client/index.ts`）：在 Web GUI 侧边栏底部槽位
  `sidebar.footer.action` 注册问候按钮。

## 构建与测试

```bash
pnpm -r --filter @hundun/dsh-hello build
pnpm -r --filter @hundun/dsh-hello typecheck
pnpm -r --filter @hundun/dsh-hello test
```

## 安装到 DSH

```bash
dsh plugin --profile <name> add link:<repo>/packages/dsh-hello
```

或经聚合包 `@hundun/dsh-all` 一键装配（见仓库根 README）。
