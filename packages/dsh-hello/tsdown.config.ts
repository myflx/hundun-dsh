/**
 * Standalone build config for the dsh-hello plugin.
 *
 * 复用共享的 dsh 客户端 bundle 预设（shared/tsdown.client.ts，源出 共享预设 /
 * DeepSeek Harness 官方 client 构建）：node 半区产出 lib/，浏览器半区产出
 * lib/client.js（供 GUI 的 __ModuleLoader__ 加载的闭包工厂产物，CSS Modules
 * 内联为自动注入的 <style data-plugin>）。
 *
 * Node 半区入口直接指向 src（tsdown 原生编译 TS），构建无需单独的 tsc emit。
 * 宿主侧 SDK 值导入（@deepseek-ai/dsh-tools 的 defineTool）必须 external，
 * 运行时由 DSH profile 树解析。
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@hundun/dsh-hello', ['src/index.ts'], {
  libExternal: [
    '@deepseek-ai/dsh-system-prompt',
    '@deepseek-ai/dsh-tools',
  ],
})
