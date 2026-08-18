/**
 * dsh-all 客户端半区（空壳）。
 *
 * 设置页骨架已迁移至 @hundun/dsh-workspace-canvas（该插件自持注册
 * settings.section「画布」，见其 src/client/settings.ts）。本半区不再注册
 * 任何设置 UI；保留空 apply 仅为维持聚合包插件行（cordis.patch.yml self 行）
 * 的客户端身份完整性，无运行时副作用。
 */
/** 聚合包客户端半区：无业务。 */
export function apply(): void {}
