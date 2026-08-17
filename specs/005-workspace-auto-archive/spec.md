# Feature Specification: 工作区会话自动归档

**Feature Branch**: `005-workspace-auto-archive`

**Created**: 2026-08-17

**Status**: Draft

**TDD**: true
<!-- MUST 为 true（项目章程 I 条）：声明后 $speckit-tasks 强制生成 Contract test 与 Integration test 任务。 -->

**Input**: User description: "为工作区增加自动归档的功能。1.设置区增加默认归档配置。2.画布工作区详情框可自定义修改。3.存储工作区会话归档配置。4.工作区刷新的时候执行归档判断逻辑。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 设置默认归档配置 (Priority: P1)

用户在设置页「画布」栏目的**归档**分组中配置全局默认：自动归档开关（默认关闭）+
**双条件阈值**——闲置天数（默认 30 天）与会话数上限。配置持久化，刷新后保持；
未开启时画布不自动归档任何会话。

**Why this priority**: 「设置区增加默认归档配置」是本特征的第一落点——默认配置是
工作区自定义与刷新判断的基础。

**Independent Test**: 设置页开启自动归档并设阈值 → 持久化；关闭 → 画布刷新不归档任何会话。

**Acceptance Scenarios**:

1. **Given** 设置页归档分组，**When** 用户开启自动归档并设闲置天数与会话上限，**Then**
   配置持久化（刷新后保持）
2. **Given** 自动归档关闭，**When** 画布刷新，**Then** 不归档任何会话

---

### User Story 2 - 详情框自定义工作区归档配置 (Priority: P1)

用户在工作区详情框的归档区域，为该工作区单独配置：**跟随默认** 或 **自定义**
（启用 + 闲置天数 + 会话数上限），覆盖全局默认；保存后持久化。

**Why this priority**: 「画布工作区详情框可自定义修改」——不同工作区可有不同归档策略
（如长期项目不归档、临时目录快速归档）。

**Independent Test**: 详情框选择自定义并保存 → 该工作区刷新时按自定义阈值判断（与默认不同）。

**Acceptance Scenarios**:

1. **Given** 详情框归档区，**When** 用户选择「自定义」并设阈值，**Then** 保存持久化，
   该工作区优先使用自定义配置
2. **Given** 详情框归档区，**When** 用户选择「跟随默认」，**Then** 清除自定义，
   恢复使用全局默认配置

---

### User Story 3 - 刷新时执行归档判断 (Priority: P1)

画布刷新（刷新按钮或 feed 更新）时，对每个启用了自动归档的工作区执行**双条件判断**：
① 闲置天数——未归档会话 `updatedAt` 距今超过阈值者归档；
② 会话数上限——未归档会话数超过上限时，按 `updatedAt` 从旧到新归档差额个；
任一条件满足即触发对应归档；已归档会话不重复处理；单个失败不阻断其余。

**Why this priority**: 「工作区刷新的时候执行归档判断逻辑」——自动归档的最终落点，
把配置转化为实际的归档动作。

**Independent Test**: 预置一个含闲置超期会话的工作区（启用自动归档）→ 触发刷新 →
该会话被归档（出现在归档计数），未超期的保留。

**Acceptance Scenarios**:

1. **Given** 工作区启用自动归档且存在闲置超期会话，**When** 画布刷新，
   **Then** 超期会话被归档，其余保留
2. **Given** 工作区未归档会话数超过上限，**When** 刷新，**Then** 最旧的差额会话被归档，
   数量收敛到上限内
3. **Given** 工作区启用自动归档，**When** 刷新，**Then** 已归档会话不被重复处理
4. **Given** 会话无 `updatedAt` 数据，**When** 刷新判断，**Then** 保守跳过（不归档）

---

### Edge Cases

- 全局默认关闭 + 工作区自定义开启 → 按工作区自定义执行
- 全局默认开启 + 工作区自定义关闭 → 该工作区不归档
- 归档失败（网络/权限）→ 提示且不阻断其他会话归档
- 刷新期间重复触发 → 判断幂等（已归档不重复、同批不并发重复归档）
- 工作区配置数据损坏 → 回退全局默认，不崩
- 无会话工作区 → 跳过
- 阈值非法（0/负数）→ 按默认阈值处理

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 设置页「画布」栏目 MUST 新增「归档」分组：自动归档开关（默认关闭）+
  双条件阈值（闲置天数默认 30 天、会话数上限默认不限制），配置持久化
  （localStorage，同 enabled/background 模式）
- **FR-002**: 工作区详情框 MUST 新增归档配置区：**跟随默认** / **自定义**
  （启用 + 闲置天数 + 会话数上限），保存即持久化
- **FR-003**: 归档配置 MUST 按「工作区自定义 > 全局默认 > 内置默认（关闭，30 天，
  不限会话数）」优先级解析；工作区配置数据损坏 MUST 回退全局默认
- **FR-004**: 画布刷新（刷新按钮）与 feed 更新时 MUST 执行双条件归档判断，条件为
  **OR**：① 未归档会话 `updatedAt` 距今超过闲置天数 → 归档该会话；
  ② 未归档会话数超过上限 → 按 `updatedAt` 从旧到新归档差额个
- **FR-005**: 归档判断 MUST 幂等：已归档会话不重复归档；同一刷新批内不重复归档同一会话
- **FR-006**: 单个会话归档失败 MUST 不阻断其余会话（失败提示一次）
- **FR-007**: 会话缺失 `updatedAt` 时 MUST 保守跳过（不参与闲置判断；数量超限场景
  按有时间的会话排序）
- **FR-008**: 归档数量 MUST 反映到画布卡片/详情框的会话统计（活跃数减少、归档数增加）

### Key Entities *(include if feature involves data)*

- **AutoArchiveConfig（归档配置）**: `enabled`（是否启用）+ `idleDays`（闲置天数阈值，
  默认 30）+ `maxSessions`（未归档会话数上限，0/缺省 = 不限制）。
  全局默认存 localStorage；工作区自定义按 workspaceId 键存 localStorage
  （`{ <workspaceId>: { mode: 'default' | 'custom', enabled?: boolean, idleDays?: number, maxSessions?: number } }`）。
- **归档判定输入**: 工作区未归档会话列表（feed `sessionIds` − `archivedSessionIds`）+
  各会话 `updatedAt`（sessions 服务 `SessionSummary.updatedAt`）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 设置页与详情框的归档配置在刷新后 100% 保持（持久化成功时）
- **SC-002**: 启用了自动归档的工作区，刷新后闲置超期会话 100% 被归档（归档接口成功时）
- **SC-003**: 未启用或未超期的会话在刷新后 0 个被误归档
- **SC-004**: 单次刷新重复触发不产生重复归档调用（幂等）
- **SC-005**: 用户可在 ≤3 次操作内完成工作区归档配置（打开详情 → 改配置 → 保存）

## Assumptions

- 「自动归档」判定条件 = **双条件（OR）**：闲置天数（`updatedAt` 距今超阈值）+
  未归档会话数上限（超过则归档最旧差额）；用户已确认
- 全局默认自动归档**默认关闭**（用户确认；安全，不静默改动用户会话）
- 内置默认值：闲置 30 天、会话数上限不限制（可配置）
- 配置持久化沿用 localStorage + 事件广播模式（与 enabled-store / background-store 一致），
  不引入后端存储
- 「工作区刷新」= 画布刷新按钮（重新拉取 feed）与 feed 订阅更新两个时机
- 归档操作使用既有 `ctx.workspaces.archiveSession(sessionId)`（逐个归档；dsh 语义：
  归档保留在 sessionIds 账目、分组界面隐藏），不新增归档 API

（无遗留 [NEEDS CLARIFICATION] 标记）
