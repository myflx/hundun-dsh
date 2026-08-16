/**
 * 检查 dsh-hello / dsh-all 是否已在运行中加载（可见标记探测）。
 * 寻找：问候按钮（title="hundun-dsh 问候"）、设置页 hundun-dsh、hello 面板元素。
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)))

await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)

const probe = async (label) => {
  const facts = await page.evaluate(() => ({
    helloButton: !!document.querySelector('[title="hundun-dsh 问候"]'),
    helloButtons: Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').includes('👋')).map((b) => b.textContent.trim().slice(0, 20)),
    helloPanel: !!document.querySelector('[data-dsh-hello-panel]'),
    settingsPage: !!document.querySelector('[data-dsh-hundun-settings-page]'),
    canvasEntry: document.querySelectorAll('[data-dsh-canvas-entry]').length,
    canvasView: !!document.querySelector('[data-dsh-canvas-view]'),
    footerActions: Array.from(document.querySelectorAll('[data-slot="sidebar.footer.action"] *')).map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 10),
    settingsTrigger: document.querySelectorAll('[data-slot="settings.trigger"] *').length,
  }))
  console.log(JSON.stringify({ label, facts }))
}

await probe('initial')
await browser.close()
console.log(JSON.stringify({ errors }, null, 2))
