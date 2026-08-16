# dsh-workspace-canvas 能力边界设计

> 依据：hundun-web `WorkspaceGraph` 画布（见 [design-hundun-canvas.md](design-hundun-canvas.md)）+ DSH 插件架构约束。
> 本文定义画布**做什么、不做什么、边界划在哪**，作为所有后续演进（P1~P3）的裁剪依据。
> 设计决策见 [orchestration-design.md §9](orchestration-design.md#9-设计决策记录)；权威协议见 [protocol-spec.md](protocol-spec.md)。

---

## 0. 一句话定位

**画布是「编排画布」**：**工作区是强制 scope 容器**——其它节点不可脱离工作区而存在；
一个画布 = 多个工作区，一个工作区 = 一个区域（scope 小画布），区域内的 agent 预设、任务、
渠道等编排节点全部隶属该工作区，用关联关系（link / 扩展边）表达编排意图。
画布只负责**定义节点模型、节点注册协议、关系表达、展示、画布数据存储**；不执行任何业务。
节点类型与连线规则由其它插件经注册协议扩展。

## 1. 领域边界（数据）

| 边界 | 内容 |
| --- | --- |
| 画布节点 | **工作区 = 强制 scope 容器**（基底节点，`WorkspaceView` 投影 + 位置存档）；**编排节点不可脱离工作区而存在**（agent 预设 / 任务 / 渠道…由插件经 `ctx.canvas.registerNodeType()` 注册，画布不做硬编码类型） |
| 数据来源 | 基底节点：官方 feed `ctx.workspaces.list`（实例数据实时读，画布只存档位置与 ref）；编排节点实例：**节点插件自己的数据域**（`data.list` 提供者），画布只存 `ref` 引用 |
| 数据归属 | 画布**不缓存、不复制**任何业务数据，只投影展示；写操作（基底）一律走官方 API（`startSession` / `rename` / `delete` / `archiveSession` / `insertBefore`） |
| 自持状态 | 画布文档（nodes / edges / view）—— 只含「引用 + 布局 + 关系」，纯 JSON，存 `localStorage['dsh.workspaceCanvas.doc.v1']`，与业务数据严格分离 |
| scope 不变量 | 每个编排节点必带合法 `workspaceId`（缺失或非法 → `meta.invalid='no-scope'`）；**归属是字段不是边**；编排节点坐标为**区域内局部坐标（px）**；`link`/扩展边默认仅限同工作区内（按 `workspaceId` 相等判定） |
| 不引入 | 不自己管理任务/笔记/文件/渠道凭据；不订阅会话内容（那是 conversation 的领域） |

## 2. 节点能力边界

### 基底节点：工作区 = scope 容器（画布内置）
- ✅ 展示：标题、路径、会话数、最近活跃标记（`recentWorkspaceId`）
- ✅ 交互：拖拽移动（成员整体跟随）、点击进入（`startSession`）、选中高亮、右键菜单
- ✅ 右键菜单：重命名（`rename`）、删除注册（`delete`，**级联删除其成员节点与边**，确认提示）、归档会话；**动作可扩展**（其它插件经 `registerNodeActions` 追加/调整）
- ✅ 明细面板：点击工作区 → 右侧弹出明细（基础信息 + 会话列表），**区块可扩展**（`registerNodeDetailSection`）
- ✅ 作为编排基底：编排节点经 `workspaceId` 字段归属；区域内可连 `link`/扩展边
- ⛔ 不做：节点内嵌文件树 / 会话列表（那是侧边栏与 aionui-panel 的职责）

### 编排节点（插件注册，agent 预设 / 任务 / 渠道 / 未来类型）
- ✅ 经 `ctx.canvas.registerNodeType()` 注册：外观（render）、实例数据（data.list）、动作（actions）、可连边（edgeKinds）
- ✅ 画布统一提供：区域内放置/拖拽/选中/连线/布局/持久化；**必须归属某工作区（workspaceId）**
- ✅ 明细面板：点击节点 → 右侧弹出明细（类型所有者 `detail` + 扩展区块）
- ⛔ 画布不执行节点业务：不跑 agent、不调度任务、不发送渠道消息 —— 动作由节点插件实现，画布只做菜单与触发转发
- ⛔ 画布不读节点业务细节：节点配置/内容/凭据留在插件域，画布只存 `ref`

### 节点扩展协议约定（详见 orchestration-design.md §3/§6）
- kind 命名 `scope:type`；`mutate` 校验 kind 已注册、ref 可解析、workspaceId 归属完整；
- 节点插件卸载 → 该类节点显示「未知类型」占位（保留位置与边），画布不删插件数据；
- 删除节点 → 连带删除其边；**删除工作区 → 级联删除其成员节点与边**（无游离态）。

## 3. 画布操作边界

| 能力 | 边界 |
| --- | --- |
| 平移/缩放 | ✅ 空白拖拽平移、滚轮缩放（**zoom 限制 0.3×~3×**）、`resetView`、`focusNode`/`focusWorkspace`（聚焦某工作区区域）；**坐标恒为场景像素，缩放/平移只动视图** |
| 拖拽移动 | ✅ 节点自由移动；拖拽中实时显示、drop 才提交；拖到工作区区域吸附 = 设置/迁移 `workspaceId`；**拖出所有工作区区域 = 无效**（无游离态） |
| 对齐辅助线 | ✅ 拖动时对其它节点中心 x/y 对齐参考 |
| 右键菜单 | ✅ 节点动作合并渲染（类型所有者 `actions` + `registerNodeActions` 扩展）；工作区内置：进入/重命名/删除（级联确认）/归档会话 |
| 明细面板 | ✅ 点击节点/工作区 → 右侧弹出明细框（类型所有者 `detail` + `registerNodeDetailSection` 扩展区块，按 order 排列）；点空白/关闭收起 |
| 连线 | ✅ 画布提供**连线协议**（拖线手势、连接点、可连目标过滤/拒绝提示、边文档存储、默认贝塞尔渲染、`onConnect`/`onDisconnect`/`validate` 钩子）；**具体连线规则由插件经 `registerEdgeRule` 实现**（能否连 `accepts`、连几条 `arity`、连上做什么、长什么样 `renderEdge`、是否跨工作区 `crossScope`）；内置 `link`（同工作区内自由边）为画布基础设施规则；**归属（workspaceId）不是连线** |
| 自动布局 | ✅ 新节点在所属工作区区域内 GRID 落位 + 冲突推挤（非用户手动摆放的节点） |
| 吸附 | ✅ 拖拽创建/拖到工作区时吸附（`SNAP_RADIUS`） |
| 画布内新建 | ⛔ 画布不提供「新建工作区」——新建是宿主能力（目录选择流）；**画布内不新建业务实例**（新建 agent/任务由各自插件/面板负责，画布只接收拖入/点击触发的创建入口，创建后必须先落入某工作区） |

## 4. 系统边界（与宿主 / 兄弟插件）

| 对象 | 边界 |
| --- | --- |
| 中间区域 | DOM 接管 `[data-pane="conversation"]`（`absolute; inset:0; z-index:60`），对话子树保持挂载但隐藏；**是「覆盖」不是「替换」** |
| 面板互斥 | **单一激活标记协议**：页面只有一个 `data-dsh-panel-active="<name>"` 属性，后写者胜；激活时写自己名字并广播 `dsh-panel-activate` 事件，收到事件且名字不是自己即关闭。协议常量/工具来自聚合仓库共享包 `@hundun/dsh-panel-protocol`（画布不再枚举/擦除其它面板的属性） |
| 侧边栏 | 唯一注入点：工作区搜索行右侧的画布按钮（DOM 注入 + 自愈）。**不注入其它区域**；侧边栏槽位（`sidebar.footer.action` 等）不占用，留给其它插件 |
| host 半区 | 只做系统提示词公告（`systemPrompt.section`）+ 配置解析；**不注册工具、不注册路由、不碰设置命名空间**（画布无宿主业务）。配置：`enabled`（总开关，双半区生效）与 `announceToAgent`（仅控制公告）由双半区共同读取 |
| 设置页 | 「hundun-dsh」设置页（`settings.section`，多栏目结构）由聚合包 **dsh-all** 提供骨架并声明子槽位；各插件注册自己的栏目（画布栏目：启用画布开关，当前唯一配置项）。画布 `enabled` 开关经设置面联动双半区；无设置服务时读组合配置兜底 |
| 节点插件（扩展方） | 经 `ctx.canvas.registerNodeType()` / `registerEdgeRule()` 贡献节点类型与连线规则；**画布提供服务、不反向依赖任何节点插件**（`ctx.get('canvas')` 可选依赖，画布缺席时节点插件正常降级） |
| 其它插件 | 不读取/不修改 task-board、ssh 等插件的数据；连线/节点仅基于官方 workspaces/sessions 域 + 节点插件数据域 |
| 卸载 | 插件卸载时：移除按钮、卸载 React 树、移除注入样式、恢复 `data-*` 属性、**保留画布文档**（`localStorage` 不清，重装即恢复）；节点插件卸载时其节点显示「未知类型」占位，画布不删其数据 |

## 5. 性能与规模边界

- 节点数量：**≤ 100 用 DOM 节点**（当前形态）；超过后进入降级策略（P2+ 再评估：静态层转 canvas 2D、列表兜底）
- 连线重算：`ResizeObserver` + 节流（≤ 16ms/帧），拖拽中高频、静止时惰性
- 文档持久化：500ms 防抖写 `localStorage`；不做跨浏览器/多标签实时同步（DSH 无此概念）
- 画布文档大小：只存引用+布局+关系（无业务数据），单文档上限约束（节点/边数量校验，超限提示而非崩溃）

## 6. 明确不做清单（Non-goals）

| 不做 | 理由 |
| --- | --- |
| 多人协作 / 实时同步 | DSH 是单用户宿主；布局共享无宿主概念 |
| 无限画布 / 无界缩放 | 边界有限（zoom 0.3~3、位置 clamp），避免维护成本 |
| 画布内执行业务（跑 agent / 调度任务 / 发渠道消息） | 业务执行者是节点插件；画布只做编排意图的表达、存储、展示、触发转发 |
| 画布内新建业务实例（新建 agent/任务/渠道） | 由各自插件/面板负责；画布只接收拖入与点击触发的创建入口 |
| 画布硬编码节点类型 | 一切新节点类型经 `ctx.canvas.registerNodeType()` 注册；画布不做 hard-code |
| 归属作为连线（member 边） | 归属是 `workspaceId` 字段；连线（edges）只表达节点间关联 |
| 画布内聊天 / 会话内容 | 那是 conversation 的领域；节点点击只负责跳转 |
| 工作区内容深度可视化 | 文件树/预览已有 aionui-panel；画布不重复 |
| 编辑器能力（缩放节点、旋转、层级 z 自由拖拽等） | 节点是「编排元素」不是「设计元素」 |
| 将画布文档同步进官方 settings 命名空间 | 画布文档是文档存储不是配置；settings 是配置域 |
| 多画布 / 画布模板 | 单画布即足够；模板属低价值复杂度 |

## 7. 边界总览图

```text
宿主（dsh web）
│  ctx.workspaces / ctx.sessions / 各插件自己的数据域
├── dsh-workspace-canvas（编排画布）
│   ├── host 半区 ── 仅公告（systemPrompt.section）+ 配置（enabled / announceToAgent）
│   └── browser 半区
│       ├── 协议：ctx.canvas 服务（registerNodeType / registerEdgeRule / 文档读写）
│       ├── 入口：搜索框按钮（DOM 注入，唯一注入点）
│       ├── 画布：编排节点（workspaceId 归属）+ 边（link/扩展）+ 平移缩放连线 + 文档存储（localStorage）
│       ├── 展示：节点外观由插件 render；画布只提供框架/选中/拖拽/连线/布局
│       └── 中间区域：DOM 覆盖 + 单一激活标记互斥（@hundun/dsh-panel-protocol）
├── 节点插件（dsh-agent-presets / dsh-task-board / dsh-ssh…）
│   └── 经 ctx.canvas 注册节点类型：数据（data.list）+ 外观（render）+ 动作（actions）
├── 兄弟面板：task-board / ssh（互斥协议经 @hundun/dsh-panel-protocol，画布不读写其数据）
└── 其它领域：conversation（聊天）、aionui-panel（文件预览）—— 画布不越界
```

## 8. 判定准则（新增功能时按此裁剪）

1. **是业务执行还是编排表达？** 执行 → 拒绝，交给节点插件；表达/存储/展示/触发转发 → 收；
2. **是否尊重「工作区 = 强制 scope」不变量？** 节点可脱离工作区存在（缺 workspaceId）/ 边可任意跨工作区
   → 拒绝（除非显式 `crossScope` 且评审通过）；
3. **数据是否来自官方 workspaces/sessions 域或节点插件数据域？** 否 → 不放进画布（需先扩数据边界，单独评审）；
4. **节点类型是否应经注册协议扩展？** 是 → 走 `ctx.canvas.registerNodeType()`，画布不做 hard-code；
5. **业务连线规则是否应插件化？** 是 → 走 `ctx.canvas.registerEdgeRule()`（accepts/arity/onConnect/renderEdge），
   画布只提供连线协议，不实现具体连线业务；
6. **是否替代了宿主/兄弟插件的职责？** 是 → 画布只做入口（点击跳转/触发），不做实现；
7. **是否会让画布变成「通用编辑器/白板」？** 是 → 拒绝，画布定位是编排画布；
8. **写操作是否走官方 API 或节点插件动作？** 否 → 拒绝（画布不持有业务写路径）；
9. **是否破坏互斥协议 / 越权注入宿主 DOM？** 是 → 拒绝。
