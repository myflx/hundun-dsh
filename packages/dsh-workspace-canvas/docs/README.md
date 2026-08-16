# dsh-workspace-canvas 文档导航

编排画布插件（dsh-workspace-canvas）的完整文档体系。建议按下列顺序阅读。

## 快速了解

| 文档 | 内容 | 适合谁 |
| --- | --- | --- |
| [../README.md](../README.md) | 插件功能总览、安装/卸载/开发（HMR） | 使用者 |
| [orchestration-design.md](orchestration-design.md) | **架构设计**：角色分工、数据边界、关系模型、存储、扩展约定（概念层）；§9 含设计决策记录 | 架构师 / 新加入者 |
| [capability-boundaries.md](capability-boundaries.md) | **能力边界**：画布做什么/不做什么、系统边界、Non-goals、判定准则 | 所有人（扩展前必读） |

## 协议与实现

| 文档 | 内容 | 适合谁 |
| --- | --- | --- |
| [protocol-spec.md](protocol-spec.md) | **协议规格（单一事实源）**：CanvasDocument v1 数据模型、`ctx.canvas` 服务接口、节点/连线规则完整类型、交互管线、命名/版本/降级约定 | 实现者 / 插件开发者（接入必读） |
| [implementation-plan.md](implementation-plan.md) | **落地计划**：P0（现状）→ P1 协议骨架 → P2 视图布局 → P3 体验面板 → P4 完善，含任务清单与验收标准 | 实现者 |

## 参考

| 文档 | 内容 |
| --- | --- |
| [design-hundun-canvas.md](design-hundun-canvas.md) | hundun-web `WorkspaceGraph` 画布的功能全景与核心机制（scene 坐标、拖拽状态机、连线、吸附、碰撞推挤、持久化），P2 阶段移植的主要来源 |

## 阅读顺序建议

1. 使用者：README → capability-boundaries；
2. 插件开发者（想给画布加节点/连线规则）：README → capability-boundaries → **protocol-spec**（§3 接口、§4 管线、§5 命名）；
3. 画布实现者：capability-boundaries → orchestration-design → **protocol-spec**（全文）→ implementation-plan（从 P1 开始）。
