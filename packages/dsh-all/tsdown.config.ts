/**
 * dsh-all 聚合包构建配置：宿主半区（src/index.ts）+ 浏览器半区（src/client/index.ts，
 * 「hundun-dsh」设置页骨架）。复用共享 tsdown.client.ts 预设。
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@hundun/dsh-all', ['src/index.ts'])
