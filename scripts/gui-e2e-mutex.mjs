/**
 * E2E 增量验证（重启 dsh 加载 dsh-hello / dsh-all 后运行）：
 *   E2E-16/17/25（hello 面板互斥）、E2E-18/19（设置开关）。
 * 前提：dsh web 已重启，profile 含 @hundun/dsh-hello 与 @hundun/dsh-all。
 * 用法：$env:NODE_PATH="C:\Users\luoshanglin\AppData\Roaming\npm\node_modules"; node scripts/gui-e2e-mutex.mjs
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

const HELLO_BTN = '[title="hundun-dsh 问候"]'
const canvasEntry = () => page.locator('[data-dsh-canvas-entry]').count()
const activeAttr = () => page.evaluate(() => document.documentElement.getAttribute('data-dsh-panel-active'))
const helloVisible = () => page.evaluate(() => {
  const p = document.querySelector('[data-dsh-hello-panel]')
  return p ? getComputedStyle(p).display !== 'none' : false
})
const canvasVisible = () => page.evaluate(() => {
  const v = document.querySelector('[data-dsh-canvas-view]')
  return v ? getComputedStyle(v).display !== 'none' : false
})

// ── 前置：dsh-hello / dsh-all 是否已加载 ──
{
  const helloBtn = await page.locator(HELLO_BTN).count()
  record('pre-hello-loaded', helloBtn > 0, { helloBtn }, helloBtn === 0 ? 'dsh-hello 未加载：需重启 dsh 后运行本脚本' : '')
}

// ── E2E-16 画布打开时开 hello 面板 → 画布让位 ──
{
  if (await page.locator(HELLO_BTN).count() === 0) {
    record('E2E-16', false, {}, 'SKIP：dsh-hello 未加载')
  } else {
    // 确保画布已打开（入口存在 ≠ 画布激活；未激活才点击）
    if ((await activeAttr()) !== 'workspace-canvas') {
      await page.locator('[data-dsh-canvas-entry]').first().click()
      await sleep(1000)
    }
    const before = await activeAttr()
    const canvasShown = await canvasVisible()
    await page.locator(HELLO_BTN).click()
    await sleep(800)
    const after = await activeAttr()
    const helloShown = await helloVisible()
    record('E2E-16', before === 'workspace-canvas' && after === 'hello-panel' && helloShown && !(await canvasVisible()), { before, after, canvasShown, helloShown }, '后写者胜：hello 面板接管，画布让位')
  }
}

// ── E2E-17 hello 面板打开时开画布 → 面板让位 ──
{
  if (await page.locator(HELLO_BTN).count() === 0) {
    record('E2E-17', false, {}, 'SKIP：dsh-hello 未加载')
  } else {
    // 确保 hello 面板打开
    const act = await activeAttr()
    if (act !== 'hello-panel') { await page.locator(HELLO_BTN).click(); await sleep(600) }
    await page.locator('[data-dsh-canvas-entry]').first().click()
    await sleep(1000)
    const after = await activeAttr()
    record('E2E-17', after === 'workspace-canvas' && (await canvasVisible()) && !(await helloVisible()), { after, canvasShown: await canvasVisible(), helloShown: await helloVisible() }, '画布接管，hello 让位')
  }
}

// ── E2E-25 画布与其他面板并发打开 → 后打开者胜，不双占 ──
{
  if (await page.locator(HELLO_BTN).count() === 0) {
    record('E2E-25', false, {}, 'SKIP：dsh-hello 未加载')
  } else {
    // 连续快速开 hello 再开画布 → 最终标记唯一
    await page.locator(HELLO_BTN).click(); await sleep(300)
    await page.locator('[data-dsh-canvas-entry]').first().click(); await sleep(800)
    const act = await activeAttr()
    const bothHidden = !(await canvasVisible()) && !(await helloVisible())
    record('E2E-25', act === 'workspace-canvas' && !bothHidden, { act, canvasShown: await canvasVisible(), helloShown: await helloVisible() }, '单一标记协议：最终只有一个面板激活')
  }
}

// ── E2E-18 关闭画布开关 → 入口消失 + 画布立即关闭 ──
{
  const settingsBtn = page.locator('[data-slot="sidebar.settings"] button')
  // 设置页导航「画布」项（navCell，精确文本匹配；画布自持 settings.section「workspace-canvas」）
  const hundunNav = page.locator('[data-slot="sidebar.settings"] button', { hasText: /^画布$/ })
  const sw = () => page.locator('[data-dsh-canvas-enabled-switch]')
  if ((await settingsBtn.count()) === 0) {
    record('E2E-18', false, { settingsBtn: 0 }, 'SKIP：设置入口不可见（dsh-all 未加载）')
  } else {
    // 确保画布开着
    if ((await canvasEntry()) === 0) { await page.locator('[data-dsh-canvas-entry]').first().click(); await sleep(800) }
    await settingsBtn.first().click()
    await sleep(1000)
    // 切到「画布」设置页（默认选中「通用设置」）
    if ((await hundunNav.count()) > 0) { await hundunNav.first().click(); await sleep(800) }
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
  const settingsBtn = page.locator('[data-slot="sidebar.settings"] button')
  const hundunNav = page.locator('[data-slot="sidebar.settings"] button', { hasText: /^画布$/ })
  const sw = () => page.locator('[data-dsh-canvas-enabled-switch]')
  if ((await settingsBtn.count()) === 0) {
    record('E2E-19', false, {}, 'SKIP：设置入口不可见')
  } else {
    // 确保设置面板已开且切到 hundun-dsh 页
    if ((await sw().count()) === 0) {
      await settingsBtn.first().click()
      await sleep(1000)
      if ((await hundunNav.count()) > 0) { await hundunNav.first().click(); await sleep(800) }
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
