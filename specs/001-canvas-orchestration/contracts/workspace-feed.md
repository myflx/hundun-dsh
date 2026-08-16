# Contract: 官方数据面调用契约（workspaces / sessions）

> 画布对官方 DSH 客户端服务的调用面（只读投影 + 官方写 API）。画布不缓存/不复制业务数据。

## 数据读取（只读投影）

| 来源 | 用途 | 形态 |
|---|---|---|
| `ctx.workspaces.list` | 工作区实例数据（标题/路径/会话数/最近活跃） | `ObservableSnapshot`：`subscribe(fn)` + `getSnapshot()`，直接喂 `useSyncExternalStore`（P0 已验证） |
| workspace 节点 `ref` | 与 feed 对齐 | 节点 `ref` = 工作区 id；feed 消失 → 级联清理（§不变量 4） |
| `ctx.sessions` | （明细面板本期只显示会话数，按 clarify Q2 不列条目） | 会话数来自 feed 投影 |

## 写操作（走官方 API，画布不持有业务写路径）

| 操作 | API | 画布行为 |
|---|---|---|
| 进入工作区新会话 | `workspaces.startSession(workspaceId)` | 点击卡片触发；失败须 catch 提示（不产生未处理拒绝） |
| 重命名 | `workspaces.rename(...)` | 右键菜单「重命名」转发 |
| 删除注册 | `workspaces.delete(workspaceId)` | 右键菜单「删除」：先确认（列出成员数）→ 级联清理画布成员 → 调官方删除（只删注册，目录与日志不动） |
| 归档会话 | `workspaces.archiveSession(...)` | 右键菜单「归档会话」转发 |

## 边界

- 画布**不新建工作区**（新建走宿主目录选择流）；「新建」不是画布能力（capability-boundaries §3）
- 画布不订阅会话内容（那是 conversation 的领域）；节点点击只负责跳转
- 工作区增删以 feed 为准：新增 → 自动补建节点；消失 → 提示 + 级联清理

## 验收（Integration test + E2E）

1. 工作区列表变化（增/删）→ 画布节点自动补建/清理（E2E-02/E2E-21）
2. 点击卡片 → 进入该工作区新会话（E2E-02）
3. 删除工作区 → 确认提示 + 级联清理 + 官方删除（E2E-11）
4. `startSession` 失败（工作区删除竞态）→ 提示且不崩溃
