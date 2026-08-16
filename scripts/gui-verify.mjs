/**
 * GUI 功能验证探针：逐项验证当前运行 GUI 中的画布交互能力。
 * 用法：$env:NODE_PATH=...; node scripts/gui-verify.mjs
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const url = 'http://127.0.0.1:3080'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))

const results = []
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(5000)

// 1) 打开画布
const entry = page.locator('[data-dsh-canvas-entry]')
results.push({ step: 'entry-button', count: await entry.count() })
if (await entry.count() > 0) {
  await entry.first().click()
  await page.waitForTimeout(1500)
  const v = await page.evaluate(() => {
    const view = document.querySelector('[data-dsh-canvas-view]')
    const r = view ? view.getBoundingClientRect().toJSON() : null
    return { viewFound: !!view, rect: r, cards: document.querySelectorAll('[data-dsh-canvas-card]').length }
  })
  results.push({ step: 'canvas-open', ...v })

  // 2) 右键第一张卡片 → 菜单项
  const card = page.locator('[data-dsh-canvas-card]').first()
  if (await card.count() > 0) {
    await card.click({ button: 'right' })
    await page.waitForTimeout(800)
    const menu = await page.evaluate(() => [...document.querySelectorAll('[data-dsh-menu-item]')].map((b) => b.textContent))
    results.push({ step: 'context-menu-items', menu })

    // 3) 点「详情」→ 明细面板
    const detailItem = page.locator('[data-dsh-menu-item="detail"]')
    if (await detailItem.count() > 0) {
      await detailItem.click()
      await page.waitForTimeout(800)
      const d = await page.evaluate(() => {
        const panel = document.querySelector('[data-dsh-canvas-detail]')
        return { detailFound: !!panel, detailText: panel ? panel.textContent.slice(0, 160) : null }
      })
      results.push({ step: 'detail-panel', ...d })
    }
  }
}
results.push({ step: 'console-errors', errors })
console.log(JSON.stringify(results, null, 2))
await browser.close()
