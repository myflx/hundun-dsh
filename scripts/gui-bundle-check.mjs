/**
 * 检查运行中的 dsh web 是否已加载新增 bundle（dsh-hello / dsh-all）。
 * 用法：
 *   $env:NODE_PATH = "C:\Users\luoshanglin\AppData\Roaming\npm\node_modules"
 *   node scripts/gui-bundle-check.mjs
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)))

await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)

const facts = await page.evaluate(() => {
  const loader = window.__ModuleLoader__
  const ids = loader ? loader.ids?.() : null
  const keys = loader && typeof loader === 'object' ? Object.keys(loader) : []
  return {
    hasLoader: !!loader,
    idCount: Array.isArray(ids) ? ids.length : (ids ? 'non-array' : null),
    hasHello: Array.isArray(ids) ? ids.some((i) => String(i).includes('hundun-hello') || String(i).includes('dsh-hello')) : null,
    hasAll: Array.isArray(ids) ? ids.some((i) => String(i).includes('hundun-all') || String(i).includes('dsh-all')) : null,
    hasCanvas: Array.isArray(ids) ? ids.some((i) => String(i).includes('hundun-canvas') || String(i).includes('workspace-canvas')) : null,
    sampleIds: Array.isArray(ids) ? ids.slice(0, 12) : null,
    loaderKeys: keys.slice(0, 20),
    panelActive: document.documentElement.getAttribute('data-dsh-panel-active'),
    settingsSections: Array.from(document.querySelectorAll('[data-slot]')).map((el) => el.getAttribute('data-slot')).slice(0, 10),
  }
})
console.log(JSON.stringify({ facts, errors }, null, 2))
await browser.close()
