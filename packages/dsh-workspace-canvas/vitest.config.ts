import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    // npm SDK 包引用未发布的 sourcemap；且浏览器 bundle 需经 vite 转换而非 node 外置。
    sourcemapIgnoreList: () => true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.{ts,tsx}'],
    server: {
      deps: {
        inline: [/@deepseek-ai\//, /@hundun\//],
      },
    },
  },
})
