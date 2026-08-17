/**
 * Standalone build config for the dsh-workspace-canvas plugin（迁移到
 * monorepo 共享的 tsdown.client.ts 预设，源出 共享预设 / DeepSeek Harness
 * 官方 client 构建）：node 半区产出 lib/，浏览器半区产出 lib/client.js
 * （供 GUI 的 __ModuleLoader__ 加载的闭包工厂产物）。
 *
 * 客户端导入审计：react / react-dom / @deepseek-ai/dsh-client-ui-primitives
 * 均在平台模块表（shared/web-platform.ts），SDK 其余均为类型导入（被擦除），
 * 共享预设的纯度门可干净放行；@hundun/dsh-panel-protocol 为内联安全层（被 bundle）。
 * 宿主侧 schemastery 为 devDep，会被打进 node bundle（与源仓库行为一致）；
 * @deepseek-ai/dsh-settings（installSettingsSection）为宿主值导入，运行时由
 * DSH profile 树解析，须 external。
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@hundun/dsh-workspace-canvas', ['src/index.ts'], {
  libExternal: [
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-system-prompt',
  ],
})
