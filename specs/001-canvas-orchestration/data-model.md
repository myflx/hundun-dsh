# Data Model: 编排画布（Canvas Orchestration）

> Phase 1 输出。实体、字段、校验规则与状态迁移；权威类型语义见
> `packages/dsh-workspace-canvas/docs/protocol-spec.md` §2（本文为面向实现的落地视图）。

## 1. CanvasDocument（画布文档，持久化载体）

| 字段 | 类型 | 说明 | 校验 |
|---|---|---|---|
| `version` | `1`（字面量） | 文档版本 | 读取时校验，低版本走 `migrate()` 链 |
| `view` | `{ x: number; y: number; zoom: number }`（可选） | 视图「镜头」（P2 启用，缺省默认视图） | zoom ∈ [0.3, 3] |
| `nodes` | `CanvasNode[]` | 全部节点 | 见 §2 不变量 |
| `edges` | `CanvasEdge[]` | 全部关系边（仅 link/扩展） | 见 §3 |

**持久化**：`localStorage['dsh.workspaceCanvas.doc.v1']`，500ms 防抖写；损坏 → `.bak` 备份 + 空文档 + 提示；配额满 → 只读降级。
**迁移**：`migrate(doc): CanvasDocument` 链（当前无旧版本，留接口）。

## 2. CanvasNode（节点）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string`（uuid v4） | 是 | 画布内唯一 |
| `kind` | `string`（`scope:type`） | 是 | 节点类型注册键；`'workspace'` = 工作区基底节点 |
| `ref` | `string` | 是 | 业务引用（workspace 节点 = 工作区 id；编排节点 = 插件实例 id；空串 = 纯编排占位） |
| `workspaceId` | `string` | 编排节点必填 | 归属：所属工作区的业务 id（与 workspace 节点 `ref` 同值）；工作区节点无此字段 |
| `label` | `string`（可选） | 否 | 展示覆盖名 |
| `position` | `{ x: number; y: number }`（px） | 是 | workspace 节点 = 场景全局坐标；编排节点 = 所属工作区区域内局部坐标 |
| `meta` | `Record<string, unknown>`（可选） | 否 | 插件自由扩展；`meta.invalid` 为画布保留 |

**不变量（校验强制，失败 → `meta.invalid` 标记，不静默删）**：
1. 每个编排节点（`kind !== 'workspace'`）必须带合法 `workspaceId`，且指向存在的 workspace 节点 ref；缺失/非法 → `meta.invalid='no-scope'`
2. 归属是字段不是边：不存在 member 边类型
3. workspace 节点 = 官方 feed 投影 + 位置存档（ref/position 存档；标题/路径/会话数实时读 feed）
4. feed 新增工作区 → 自动补建节点（自动落位）；feed 消失 → 提示 + 级联删除其成员节点与边

## 3. CanvasEdge（关系边）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string`（uuid v4） | 是 | 唯一 |
| `kind` | `string` | 是 | `'link'` 或 `<scope>:<edge-kind>`（插件注册）；无 member |
| `source` / `target` | `string` | 是 | 指向存在的节点 id |
| `meta` | `Record<string, unknown>`（可选） | 否 | 规则插件扩展字段 |

**校验**：同 `(kind, source, target)` 至多一条（查重）；`link`/扩展边默认仅限同一工作区内（两端 `workspaceId` 相等），跨区需规则 `crossScope: true`；`meta.invalid` 保留字段。

## 4. 注册表（ctx.canvas 服务持有，不持久化）

| 实体 | 关键字段 | 说明 |
|---|---|---|
| `NodeTypeDefinition` | `kind` / `label` / `data.list` / `render` / `detail?` / `actions?` / `edgeKinds?` / `order?` | 节点类型注册；重复 kind 注册抛错 |
| `EdgeRuleDefinition` | `kind` / `accepts` / `arity?` / `onConnect?` / `onDisconnect?` / `renderEdge?` / `metaFields?` / `ports?` / `crossScope?` / `validate?` | 连线规则注册 |
| `NodeAction` | `id` / `label` / `run(node, doc)` | 右键动作（类型所有者 + `registerNodeActions` 扩展合并） |
| `NodeDetailSection` | `render` / `label` / `order?` | 明细区块（类型所有者 `detail` + `registerNodeDetailSection` 扩展合并） |

**生命周期**：注册返回 disposer；插件卸载即注销；卸载后节点显示「未知类型」占位，数据保留。

## 5. 配置（设置面）

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | boolean | true | 总开关（双半区生效；关闭时入口/内容/公告消失，画布正打开则立即关闭——clarify Q1） |
| `announceToAgent` | boolean | true | 仅控制宿主公告 |

**载体**：settings 命名空间 `hundun.canvas`（官方 settings）；宿主 `installSettingsSection` 联动 + 客户端 `settingsScope.bind`；无设置服务时读组合配置兜底。

## 6. 运行时状态（不持久化）

| 状态 | 值域 | 说明 |
|---|---|---|
| 画布开关 | `open` / `closed` | controller 状态机；与其它面板互斥 |
| 面板激活标记 | `documentElement.dataset.dshPanelActive` | 单标记，值 = 当前激活面板名；后写者胜（协议见 contracts/panel-protocol.md） |
| 选中节点 | `nodeId \| undefined` | 驱动右侧明细面板 |

**状态迁移（面板互斥）**：
```text
closed --open()--> open --(其它面板 activate)--> closed
open   --close()--> closed
open   --(dsh-hello 测试面板 activate)--> closed（互斥让位）
```

## 7. 边界与规模

- 工作区 ≤ 100、节点 ≤ 100（DOM 渲染；超限降级留 P2 评估）
- 单画布单文档；单用户单浏览器；无跨设备同步
- 画布文档只含「引用 + 布局 + 关系」，不含业务数据
