# 画布协议规格（Canvas Protocol Spec）

> **单一事实源**：本文是 `dsh-workspace-canvas` 编排画布的权威协议规格，实现与接入一律以本文为准。
> 配套文档：架构设计 [orchestration-design.md](orchestration-design.md)（概念层）、能力边界 [capability-boundaries.md](capability-boundaries.md)、落地计划 [implementation-plan.md](implementation-plan.md)。
>
> 协议版本：**v1**（本文定义画布文档模型 `CanvasDocument.version = 1` 与 `ctx.canvas` 服务契约）。

---

## 1. 总览

```text
节点插件 / 连线规则插件（消费方）
        │  ctx.get('canvas')  （可选依赖，画布缺席时正常降级）
        ▼
ctx.canvas（cordis 服务，由 dsh-workspace-canvas 提供）
        │  registerNodeType / registerEdgeRule / readDocument / subscribe / mutate
        ▼
画布文档（CanvasDocument v1，localStorage['dsh.workspaceCanvas.doc.v1']）
```

- 画布提供：节点/连线规则的**注册协议**、画布交互框架、文档存储与校验、展示框架；
- 插件提供：节点类型（数据/外观/动作）、连线规则（能否连/连几条/连上做什么/长什么样）；
- 画布**不执行任何业务**、**不硬编码任何节点/边类型**（内置 `member`/`link` 是画布基础设施规则）。

## 2. 数据模型（CanvasDocument v1）

### 2.1 文档

```ts
/** 画布文档（纯 JSON，可序列化；持久化为 localStorage['dsh.workspaceCanvas.doc.v1']）。 */
interface CanvasDocument {
  version: 1
  /** 画布视图（平移 + 缩放）；缺省 = 默认视图。 */
  view?: { x: number; y: number; zoom: number }
  /** 全部节点（编排元素）。 */
  nodes: CanvasNode[]
  /** 全部关系边。 */
  edges: CanvasEdge[]
}
```

### 2.2 节点

```ts
/** 一个画布节点：画布只解释 id/kind/ref/position，其余透传。 */
interface CanvasNode {
  /** 画布内唯一 id（uuid v4 字符串）。 */
  id: string
  /** 节点类型 key（注册表），命名 `scope:type`，如 `dsh:agent-preset` / `channel:wechat`。
   *  `kind === 'workspace'` 为工作区基底节点（scope 容器），其余为编排节点。 */
  kind: string
  /** 业务实例引用（agent slug / task id / 渠道实例 id）；空串 = 无业务背书的纯编排占位。 */
  ref: string
  /** 展示覆盖名（缺省取节点插件 data.list 解析出的实例标题）。 */
  label?: string
  /**
   * 坐标语义按 kind 区分：
   * - workspace 节点：**全局画布坐标**（scene 0-100 百分比）；
   * - 编排节点：**所属工作区区域内的坐标**（scope 小画布坐标，0-100 百分比）。
   * 渲染时编排节点绝对位置 = 所属工作区位置 + 本坐标；拖动工作区 = 其成员整体跟随。
   */
  position: { x: number; y: number }
  /** 节点插件自由扩展字段，画布透传不解释（如折叠态、样式覆盖）。 */
  meta?: Record<string, unknown>
}
```

### 2.3 核心不变量：工作区 = 强制 scope

**工作区是画布最基础的节点，其它节点不可脱离工作区而存在。** 一个完整画布 = 多个工作区；
一个工作区 = 一个区域（scope 小画布），该区域内的全部节点都隶属该工作区。

```text
CanvasDocument
├── workspace 节点 A（全局坐标）──── member ──► 编排节点 a1（区域内坐标）
│                                    member ──► 编排节点 a2（区域内坐标）
├── workspace 节点 B（全局坐标）──── member ──► 编排节点 b1（区域内坐标）
└── 编排节点间的 link / 扩展边（可在同工作区内，也可跨工作区？见 §4.4）
```

不变量（画布校验强制）：

1. **每个编排节点（kind !== 'workspace'）恰有一条 `member` 边**（归属唯一且必需）；
   无 member 边 → 节点无效（`meta.invalid = 'no-scope'`），不渲染、提示用户归属；
2. **member 边的源必须是 workspace 节点**，目标必须是编排节点；
3. 工作区节点的 `data.list` 决定「画布上有哪些工作区」——工作区由官方 `ctx.workspaces` 投影，
   画布不创建工作区（新建走宿主目录选择流）；
4. **删除工作区 = 级联删除其全部成员节点与边**（成员无独立存在）；删除前确认提示。

### 2.4 边

```ts
/** 一条关系边。 */
interface CanvasEdge {
  id: string
  /** 边类型：'member' | 'link' | '<scope>:<edge-kind>'（内置两类 + 插件注册）。 */
  kind: string
  /** 源节点 id → 目标节点 id。 */
  source: string
  target: string
  /** 规则插件扩展字段（如触发条件、参数），由 metaFields 定义。 */
  meta?: Record<string, unknown>
}
```

约束：
- `source` / `target` 必须指向存在的节点 id（否则边无效）；
- 同 `(kind, source, target)` 至多一条（查重）；
- `member` 边满足 §2.3 不变量（源 = workspace、目标 = 编排节点、目标每节点恰一条）；
- `link` / 扩展边默认**仅限同工作区内的节点之间**（编排在 scope 内）；跨工作区连线需边规则显式声明 `crossScope: true`（见 §3.4）；
- `meta.invalid` 为画布保留字段（validate 失败标记）。

## 3. ctx.canvas 服务契约

### 3.1 消费方接入

```ts
// 节点插件 browser 半区：可选依赖（画布缺席时 ctx.get('canvas') 为 undefined，正常降级）
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 编排画布注册表（dsh-workspace-canvas 提供；缺席 = undefined）。 */
    canvas?: CanvasRegistry
  }
}

// 在 apply(ctx) 中：
const canvas = ctx.get('canvas')
if (canvas !== undefined) {
  ctx.effect(() => canvas.registerNodeType({ ... }), 'my-plugin: node type')
}
```

### 3.2 接口

```ts
interface CanvasRegistry {
  /** 注册节点类型；返回注销函数（插件卸载时调用）。 */
  registerNodeType(def: NodeTypeDefinition): () => void

  /** 注册连线规则；返回注销函数。 */
  registerEdgeRule(def: EdgeRuleDefinition): () => void

  /** 读当前画布文档（只读快照；内容变化时引用更新）。 */
  readDocument(): CanvasDocument

  /** 订阅文档变化（任何写入/校验后触发）。 */
  subscribe(fn: (doc: CanvasDocument) => void): () => void

  /**
   * 写入画布文档（合并式）。
   * 画布负责：kind/ref/边完整性校验、查重、写 localStorage（500ms 防抖）、触发订阅。
   * 非法写入被拒绝并抛错（调用方可捕获提示）。
   */
  mutate(mutator: (draft: CanvasDocument) => void): void
}
```

### 3.3 节点类型定义

```ts
interface NodeTypeDefinition {
  /** 唯一 kind，命名 `scope:type`。 */
  kind: string
  label: { zh: string; en: string }
  /** 面板/创建菜单排序（数字小靠前）。 */
  order?: number

  /** 实例数据访问（画布不碰业务域）。 */
  data: {
    /** 列出该类型全部实例（订阅式快照）。 */
    list(ctx: ClientContext): ObservableSnapshot<NodeInstance[]>
    /** 实例 → 画布节点默认内容（label/meta），可选。 */
    toNode?(instance: NodeInstance): Partial<Pick<CanvasNode, 'label' | 'meta'>>
  }

  /** 节点外观（React 受控组件）。 */
  render: ComponentType<NodeViewProps>

  /** 节点动作（右键菜单）；画布只转发调用。 */
  actions?: NodeAction[]

  /** 该类型节点愿意参与的边种类（与边规则 accepts 取交集）。 */
  edgeKinds?: string[]
}

interface NodeViewProps {
  node: CanvasNode
  /** 经 data.list 解析出的实例；kind 无实例或未解析到时为 undefined。 */
  instance?: NodeInstance
  selected: boolean
  dragging: boolean
  onSelect(): void
  /** 默认动作（双击/回车）：如打开该工作区/任务。 */
  onOpen(): void
}

interface NodeAction {
  id: string
  label: { zh: string; en: string }
  run(node: CanvasNode, doc: CanvasDocument): void | Promise<void>
}
```

### 3.4 连线规则定义

```ts
interface EdgeRuleDefinition {
  /** 唯一边类型，命名 `scope:edge`（内置 member/link 除外）。 */
  kind: string
  label: { zh: string; en: string }
  order?: number

  /** 连接合法性：false / {ok:false,reason} 拒绝并展示 reason；{ok:true} 通过。 */
  accepts(source: CanvasNode, target: CanvasNode, doc: CanvasDocument): boolean | { ok: true } | { ok: false; reason: string }

  /** 数量约束（默认 'unlimited'）：该类边在源/目标节点上的条数上限。 */
  arity?: { source?: number | 'unlimited'; target?: number | 'unlimited' }

  /** 连接建立钩子（业务写在这里）；抛错/拒绝 → 边不落地。 */
  onConnect?(edge: CanvasEdge, doc: CanvasDocument): void | Promise<void>

  /** 连接断开钩子（业务清理）。 */
  onDisconnect?(edge: CanvasEdge, doc: CanvasDocument): void | Promise<void>

  /** 边渲染（缺省：贝塞尔 + 箭头）。 */
  renderEdge?: ComponentType<EdgeViewProps>

  /** 边元数据字段（连线后编辑表单的 schema）。 */
  metaFields?: MetaField[]

  /** 连接点：从节点哪些位置拖出/拖入（缺省四边）。 */
  ports?: { sourceSides?: ConnectionSide[]; targetSides?: ConnectionSide[] }

  /** 是否允许跨工作区连线（缺省 false：link/扩展边默认仅限同工作区内，编排在 scope 内）。 */
  crossScope?: boolean

  /** 存量边校验（文档加载/保存时）；返回 reason 标记无效（不静默删）。 */
  validate?(edge: CanvasEdge, doc: CanvasDocument): string | null
}

interface EdgeViewProps {
  edge: CanvasEdge
  /** 源/目标节点（可能缺失：节点已删但边残留的中间态）。 */
  source?: CanvasNode
  target?: CanvasNode
  /** 贝塞尔几何（画布已算好，缺省渲染直接用）。 */
  geometry: { control1: { x: number; y: number }; control2: { x: number; y: number } }
  selected: boolean
  /** 拖拽弯曲手柄值（-18 ~ 18）。 */
  bend: number
}

interface MetaField {
  key: string
  label: { zh: string; en: string }
  type: 'string' | 'number' | 'boolean' | 'select'
  options?: { value: string; label: { zh: string; en: string } }[]  // type = 'select'
  required?: boolean
  /** 缺省值（写入 edge.meta[key]）。 */
  default?: unknown
}

type ConnectionSide = 'top' | 'right' | 'bottom' | 'left'
```

### 3.5 内置规则行为规格（画布实现）

| 规则 | accepts | arity | 强制 | 渲染 |
| --- | --- | --- | --- | --- |
| `member` | 源 = 工作区基底节点（`kind === 'workspace'`），目标 = 任意编排节点（`kind !== 'workspace'`） | `target: 1`（归属唯一） | **每个编排节点必须恰有一条**（§2.3 不变量；缺失 → `meta.invalid='no-scope'`，节点不渲染并提示归属） | 细实线（区域内不显式绘制，用于表达归属） |
| `link` | 两端任意（除非端点节点 `edgeKinds` 排除该边）；**默认仅限同工作区内** | 不限 | 否 | 默认贝塞尔 + 箭头 |

`member` 交互：拖编排节点到某工作区区域 = 建立 member（若已有归属则迁移）；拖出所有工作区区域 = 无效（无游离态，提示先选择目标工作区）。

## 4. 交互管线规范

### 4.1 建边（拖线）

1. 用户在源节点端口按下拖出 → 画布枚举候选规则：源节点 `edgeKinds` 含该边 **且** 规则已注册；
2. 对每个候选目标节点跑 `accepts(source, target, doc)`；通过者进入可连集合；
3. **scope 过滤**：非 `crossScope` 边只允许源/目标同属一个工作区（经 member 边判定）；
4. 悬停：可连目标高亮，不可连目标禁用并展示 `reason`；
5. 松手于可连目标 → 画布查重（同 kind/source/target 存在则忽略）+ `arity` 校验（源/目标该边条数上限）；
6. `await onConnect(edge, doc)` → 成功则写入文档（`mutate`），失败则边不落地并提示；
7. 松手于空白 → 取消拖线。

### 4.2 删边 / 删节点 / 删工作区

- 删边：右键边 → 菜单「删除」或拖回源端口 → `await onDisconnect(edge, doc)` → 写入文档移除；
- 删节点：先对其全部边跑 `onDisconnect`，再移除节点与边（一次 `mutate`）；
- **删工作区（scope）**：级联删除其全部成员节点与边（成员不可脱离 scope，§2.3 不变量）；
  删除前确认提示（列出将删除的成员数）；删除工作区本身走官方 `ctx.workspaces.delete`（只删注册，
  目录与日志不动），画布随后从 `data.list` 投影中自然消失。

### 4.3 节点归属（member）操作

- 新建编排节点（拖拽创建/菜单创建）：**必须先落到某工作区区域**（吸附）→ 同时建立 member 边；
- 拖编排节点到另一工作区区域：member 边迁移（旧的移除、新的建立，一次 `mutate`）；
- 拖出所有工作区区域：无效，节点保持原位并提示「请拖入目标工作区」（不产生游离态）；
- 工作区被业务删除前，画布侧已无该工作区 → 其成员节点一并清理（见 4.2）。

### 4.4 文档加载/保存校验

- 加载：逐边跑 `validate`、逐节点检查 `kind` 已注册、**检查 §2.3 不变量**
  （每个编排节点恰一条 member 边、member 源为 workspace、link 未跨 scope）→
  无效项标记 `meta.invalid`（含 `'no-scope'`）并提示（不静默删）；
- 保存：`mutate` 时执行同套校验，非法写入抛错拒绝。

## 5. 命名与冲突规则

| 对象 | 命名 | 冲突处理 |
| --- | --- | --- |
| 节点类型 kind | `scope:type`（如 `dsh:agent-preset`、`channel:wechat`） | 重复注册同 kind → 后者注册抛错（保留先注册者） |
| 边类型 kind | `scope:edge`（如 `orchestra:assign`）；内置 `member` / `link` 保留 | 同上 |
| 画布保留字段 | `meta.invalid` | 插件不得占用；文档校验专用 |
| localStorage key | `dsh.workspaceCanvas.doc.v1` | 版本号并入 key，迁移时换 key + 迁移逻辑 |

## 6. 版本与兼容

- **协议版本** = `CanvasDocument.version`（当前 1）；
- 升级流程：读取时 `version` 低 → 跑迁移函数（`migrate(doc): CanvasDocument` 链）→ 写回新 key；
- 旧版本文档**只读保留**（迁移失败不覆盖）；
- 节点/边类型注册表无版本（运行时注册，插件与画布同时挂载即可，无需画布版本同步）；
- 画布升级不要求节点插件升级；节点插件数据结构变化不影响画布文档（画布只存 ref）。

## 7. 错误与降级约定

| 场景 | 行为 |
| --- | --- |
| 画布插件未安装 | `ctx.get('canvas') === undefined` → 节点插件跳过注册，功能缺席但不报错 |
| localStorage 配额满 / 写失败 | 降级只读 + 一次性提示，不丢内存中文档（下次成功写） |
| 文档损坏（JSON 解析失败） | 备份原串（`…doc.v1.bak`）→ 以空文档启动并提示 |
| 节点插件卸载（类型仍存在） | 该类节点渲染「未知类型」占位，位置/边保留，重装即恢复 |
| 规则插件卸载（边仍存在） | 该类边渲染「未知规则」占位，数据保留 |
| 业务实例被删（ref 失效） | 节点显示「实例缺失」状态（`data.list` 解析不到），节点与边保留，供用户清理 |
