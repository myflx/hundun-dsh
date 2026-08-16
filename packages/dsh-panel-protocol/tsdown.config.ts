/**
 * 构建配置：纯常量/工具库，无宿主/浏览器半区之分（消费者 bundle 内联本包）。
 * 复用共享的 tsdown.client.ts 预设：node 半区产出 lib/，无 src/client 入口故无客户端 face。
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@hundun/dsh-panel-protocol', ['src/index.ts'])
