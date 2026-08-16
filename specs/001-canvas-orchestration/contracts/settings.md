# Contract: hundun-dsh 设置页

> 聚合品牌设置面。设计决策 D10 + clarify Q1/Q4。页面骨架由聚合包 `dsh-all` 提供，栏目由各插件注册。

## 页面骨架（dsh-all 客户端半区）

- 注册 `settings.section` 条目：`id: 'hundun-dsh'`，`label: 'hundun-dsh'`，`order: 20`（官方页之后）
- 页面内声明子槽位 `hundun.settings.item`（list），供各插件注册自己的栏目
- `dsh-all` 需要客户端半区（aggregate.yml 增 `self` 行 + src/client + 构建配置）

## 栏目注册（插件侧）

| 插件 | 栏目 id | 配置项 | 命名空间 |
|---|---|---|---|
| dsh-workspace-canvas | `canvas` | `enabled`（启用画布开关）| `hundun-canvas` |
| （未来）dsh-hello / task-board / ssh | 各自栏目 | — | — |

## 画布栏目 schema（schemastery）

```ts
const Config = z.object({
  enabled: z.boolean().default(true),        // 总开关（双半区生效）
  announceToAgent: z.boolean().default(true), // 仅控制宿主公告（本期不在设置面暴露，保留组合配置）
})
```

## 生效链路（双半区实时联动）

1. 用户在设置页切换 `enabled`
2. 客户端：`settingsScope.bind({ namespace: 'hundun-canvas' })` 订阅 → `enabled=false` 时
   **立即**卸载画布入口按钮与画布视图（clarify Q1）、移除互斥标记；`true` 时重新挂载（布局保留）
3. 宿主：`installSettingsSection` 联动 → `enabled=false` 时移除公告段落
4. 无设置服务时：读组合文件配置兜底（缺省 enabled=true）

## 验收（E2E-18/19）

1. 关闭开关 → 入口/内容/公告均消失；若画布正打开则立即关闭；其他功能不受影响
2. 重新开启 → 恢复且布局保留
