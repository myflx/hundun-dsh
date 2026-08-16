/**
 * GUI 探针（本地调试工具）：驱动真实浏览器打开 dsh web，点击画布入口，
 * 抓取画布状态、DOM 事实与控制台错误。用法：
 *   $env:NODE_PATH = "C:\Users\luoshanglin\AppData\Roaming\npm\node_modules"
 *   node scripts/gui-probe.mjs [--no-click]
 */
import { createRequire } from 'node:module'

// 全局 playwright（经 NODE_PATH 解析；ESM 不直接认 NODE_PATH，用 createRequire 兜底）。
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const url = 'http://127.0.0.1:3080'
const noClick = process.argv.includes('--no-click')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`))

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(5000) // 应用启动 + 连接建立

const result = { url, entryCount: 0, clicked: false }

// 侧边栏画布入口
const entry = page.locator('[data-dsh-canvas-entry]')
result.entryCount = await entry.count()

if (result.entryCount > 0 && !noClick) {
  await entry.first().click()
  result.clicked = true
  await page.waitForTimeout(2000)
}

result.facts = await page.evaluate(() => {
  const view = document.querySelector('[data-dsh-canvas-view]')
  return {
    panelActiveAttr: document.documentElement.getAttribute('data-dsh-panel-active'),
    slotConversation: !!document.querySelector('[data-slot="conversation"]'),
    viewFound: !!view,
    viewText: view ? view.textContent.slice(0, 250) : null,
    viewHtml: view ? view.innerHTML.slice(0, 500) : null,
    cardCount: document.querySelectorAll('[data-dsh-canvas-card]').length,
    errorBoundary: !!document.querySelector('[data-dsh-canvas-error]'),
    workspaceCount: document.querySelectorAll('[data-slot="conversation"] *').length,
  }
})
result.consoleErrors = errors

console.log(JSON.stringify(result, null, 2))
await browser.close()
