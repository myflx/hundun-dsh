/**
 * dsh-all 宿主半区。
 *
 * 聚合包本身作为插件行（aggregate.yml 的 self: hundun-all）加载；宿主半区无业务，
 * 设置页骨架由客户端半区（src/client/）提供。
 */
import type { Context } from '@deepseek-ai/cordis'

/** 插件 id（与 cordis.patch.yml 的 self 行 id 一致）。 */
export const name = 'hundun-all'

/** 聚合包宿主半区：无宿主业务。 */
export function apply(_ctx: Context): void {}
