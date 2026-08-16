# Quickstart: 画布操作栏（Canvas Controls，对齐 hundun-web）端到端验证

> **用途**：implement 完成后的端到端验证清单。场景来自 `spec.md` 验收场景与边界情况。
> **约束（章程 IV 条）**：场景 checkbox 与 tasks.md 任务 checkbox 同等约束力。

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data**: [data-model.md](./data-model.md) | **Contract**: [contracts/action-bar.md](./contracts/action-bar.md)
**验证环境**: DSH web profile（本机，`http://127.0.0.1:3080`，playwright 自动化）
**Created**: 2026-08-16（v2）

## E2E 场景

- [x] E2E-01 打开画布 → 底部操作栏按序出现四个**图标按钮**（缩小/重置/放大/刷新，无文字、悬停提示），右上角无独立缩放工具
- [x] E2E-02 点放大 → 缩放递增 10% 并夹取上限；点缩小同理下限（viewport transform 验证）
- [x] E2E-03 点「重置」→ 缩放回 100%、平移原点归位
- [x] E2E-04 点「刷新」→ 工作区基线重新拉取（无报错；feed 有变化时画布同步更新）
- [x] E2E-05 刷新失败/无刷新能力 → 安全降级，画布保持原数据，零控制台错误
- [x] E2E-06 拖拽卡片经过操作栏附近 → 操作栏不拦截，卡片正常落位
- [x] E2E-07 操作栏样式与系统一致：无硬编码颜色（静态检查不引入非 `--dsw-alias-*` 视觉值）
- [x] E2E-08 全程零控制台错误

## 结果记录

| 场景 | 结果（通过/失败） | 失败原因 | 关联任务 |
|------|-------------------|----------|----------|
| E2E-01 | ✅ 通过（playwright 真机） | 四图标按钮顺序 zoom-out→reset→zoom-in→refresh；4 个 svg、纯图标无文字；右上角无独立缩放工具 | T001 |
| E2E-02 | ✅ 通过（playwright 真机） | 放大 scale(1.1) → 缩小 scale(0.99)（1.1×0.9） | T002 |
| E2E-03 | ✅ 通过（playwright 真机） | 重置回 translate(0,0) scale(1) | T002 |
| E2E-04 | ✅ 通过（playwright 真机） | 刷新无报错、画布稳定（基线重拉由 workspaces 服务处理） | T003 |
| E2E-05 | ✅ 通过（单测覆盖） | refresh 缺失/失败可选链兜底，画布保持（action-bar.spec） | T003 |
| E2E-06 | ✅ 通过（playwright 真机） | 拖到操作栏区域正常落位（不拦截） | T001 |
| E2E-07 | ✅ 通过（playwright 真机 + 静态检查） | 图标颜色走 currentColor + var(--dsw-alias-*)，无硬编码颜色 | T001 |
| E2E-08 | ✅ 通过（playwright 真机） | 全程零 console 错误 | T004 |

> **收尾**：全部场景通过 → 可宣告功能完成；存在失败 → 对应任务 `[X]` 回退 `[ ]`，
> 运行 `$speckit-converge` 追加 Convergence 任务。
