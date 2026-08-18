/**
 * E2E 增量验证（重启 dsh 加载 dsh-all 后运行）：
 *   E2E-18/19（画布设置开关：关闭 → 入口消失 + 画布关闭；重开 → 恢复且布局保留）。
 * 前提：dsh web 已重启，profile 含 @hundun/dsh-all。
 * 用法：$env:NODE_PATH="C:\Users\luoshanglin\AppData\Roaming\npm\node_modules"; node scripts/gui-e2e-settings.mjs
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const url = process.env.E2E_URL ?? 'http://127.0.0.1:3080'
const results = []
const record = (id, pass, detail, notes = '') => results.push({ id, pass: pass ? 'PASS' : 'FAIL', detail, notes })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await sleep(5000)

const canvasEntry = () => page.locator('[data-dsh-canvas-entry]').count()
const canvasVisible = () => page.evaluate(() => {
  const v = document.querySelector('[data-dsh-canvas-view]')
  return v ? getComputedStyle(v).display !== 'none' : false
})
const settingsBtn = () => page.locator('[data-slot="sidebar.settings"] button')
const canvasNav = () => page.locator('[data-slot="sidebar.settings"] button', { hasText: /^画布$/ })
const sw = () => page.locator('[data-dsh-canvas-enabled-switch]')

// ── E2E-18 关闭画布开关 → 入口消失 + 画布立即关闭 ──
{
  if ((await settingsBtn().count()) === 0) {
    record('E2E-18', false, { settingsBtn: 0 }, 'SKIP：设置入口不可见（dsh-all 未加载）')
  } else {
    // 确保画布开着
    if ((await canvasEntry()) === 0) { await page.locator('[data-dsh-canvas-entry]').first().click(); await sleep(800) }
    await settingsBtn().first().click()
    await sleep(1000)
    // 切到「画布」设置页（默认选中「通用设置」）
    if ((await canvasNav().count()) > 0) { await canvasNav().first().click(); await sleep(800) }
    const swVisible = await sw().count()
    if (swVisible > 0 && (await sw().isChecked())) {
      await sw().uncheck()
      await sleep(800)
    }
    const entryAfter = await canvasEntry()
    const canvasStill = await canvasVisible()
    // 还原开关
    if (await sw().count() > 0 && !(await sw().isChecked())) { await sw().check(); await sleep(800) }
    record('E2E-18', swVisible > 0 && entryAfter === 0 && !canvasStill, { swVisible, entryAfter, canvasStill }, '关闭开关后入口消失、画布关闭；其他功能不受影响由单测覆盖')
  }
}

// ── E2E-19 重新开启 → 恢复且布局保留 ──
{
  if ((await settingsBtn().count()) === 0) {
    record('E2E-19', false, {}, 'SKIP：设置入口不可见')
  } else {
    // 确保设置面板已开且切到「画布」页
    if ((await sw().count()) === 0) {
      await settingsBtn().first().click()
      await sleep(1000)
      if ((await canvasNav().count()) > 0) { await canvasNav().first().click(); await sleep(800) }
    }
    const beforePos = await page.evaluate(() => {
      const card = document.querySelector('[data-dsh-canvas-card]')
      return card ? { left: card.style.left, top: card.style.top } : null
    })
    if ((await sw().count()) > 0 && !(await sw().isChecked())) { await sw().check(); await sleep(800) }
    await sleep(500)
    const entryAfter = await canvasEntry()
    // 关闭设置面板（模态遮罩会拦截画布入口点击）
    const closeBtn = page.locator('[data-slot="settings.close"] button, [data-slot="settings.close"] [role="button"]')
    if ((await closeBtn.count()) > 0) await closeBtn.first().click()
    else await page.keyboard.press('Escape')
    await sleep(800)
    await page.locator('[data-dsh-canvas-entry]').first().click()
    await sleep(1000)
    const afterPos = await page.evaluate(() => {
      const card = document.querySelector('[data-dsh-canvas-card]')
      return card ? { left: card.style.left, top: card.style.top } : null
    })
    const posKept = beforePos !== null && afterPos !== null && beforePos.left === afterPos.left && beforePos.top === afterPos.top
    record('E2E-19', entryAfter > 0 && posKept, { entryAfter, beforePos, afterPos, posKept }, '重开开关后入口恢复；布局位置保留')
  }
}

record('console', errors.length === 0, { errorCount: errors.length, errors: errors.slice(0, 5) })
console.log(JSON.stringify(results, null, 2))
try { await browser.close() } catch { /* noop */ }
