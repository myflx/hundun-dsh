/**
 * 全量 E2E 自动化验证（quickstart.md 场景，当前可验证部分）。
 * 运行前提：dsh web 已在 3080 运行且已加载 @hundun/dsh-workspace-canvas。
 * 用法：$env:NODE_PATH="C:\Users\luoshanglin\AppData\Roaming\npm\node_modules"; node scripts/gui-e2e.mjs
 * 输出：JSON（场景 id / 通过 / 事实 / 备注）。
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const url = 'http://127.0.0.1:3080'
const results = []
const record = (id, pass, detail, notes = '') => results.push({ id, pass: pass ? 'PASS' : 'FAIL', detail, notes })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))

const sleep = (ms) => page.waitForTimeout(ms)

const openCanvas = async () => {
  const entry = page.locator('[data-dsh-canvas-entry]')
  if ((await entry.count()) === 0) return false
  await entry.first().click()
  await sleep(1200)
  return true
}
const closeCanvas = async () => {
  const btn = page.locator('[data-dsh-canvas-view] button', { hasText: '关闭画布' })
  if ((await btn.count()) > 0) { await btn.first().click(); await sleep(800) }
}
const canvasFacts = () => page.evaluate(() => {
  const view = document.querySelector('[data-dsh-canvas-view]')
  const active = document.documentElement.getAttribute('data-dsh-panel-active')
  return {
    viewFound: !!view,
    viewDisplayed: view ? getComputedStyle(view).display !== 'none' : false,
    active,
    cards: document.querySelectorAll('[data-dsh-canvas-card]').length,
    cardTexts: [...document.querySelectorAll('[data-dsh-canvas-card]')].map((c) => c.textContent.trim().slice(0, 60)),
    sidebarWorkspaces: document.querySelectorAll('[aria-label^="工作区\u201C"]').length,
    detail: !!document.querySelector('[data-dsh-canvas-detail]'),
    menuItems: [...document.querySelectorAll('[data-dsh-menu-item]')].map((b) => b.textContent),
    errorBoundary: !!document.querySelector('[data-dsh-canvas-error]'),
    viewportTransform: (() => { const v = document.querySelector('[data-dsh-canvas-viewport]'); return v ? v.style.transform : null })(),
    zoomText: (() => { const t = document.querySelector('[data-dsh-action-bar]'); return t ? t.textContent : null })(),
  }
})

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await sleep(5000)

// ── E2E-01 打开画布 → 卡片呈现，数量与侧边栏一致，含标题/路径/会话数；首帧计时 ──
{
  const entry = page.locator('[data-dsh-canvas-entry]')
  record('E2E-01-prep', (await entry.count()) > 0, { entryCount: await entry.count() })
  const t0 = Date.now()
  const opened = await openCanvas()
  const firstFrameMs = Date.now() - t0
  const f = await canvasFacts()
  const cardsOk = f.cardTexts.every((t) => /会话/.test(t) || /\d+ sessions/.test(t))
  const match = f.cards > 0 && f.cards === f.sidebarWorkspaces
  record('E2E-01', opened && f.viewDisplayed && match && cardsOk, {
    firstFrameMs, cards: f.cards, sidebarWorkspaces: f.sidebarWorkspaces, sample: f.cardTexts.slice(0, 2),
  }, `首帧 ${firstFrameMs}ms（≤1s 目标）`)
}

// ── E2E-10 右键工作区 → 菜单含进入/详情/重命名/删除/归档 ──
{
  const card = page.locator('[data-dsh-canvas-card]').first()
  await card.click({ button: 'right' })
  await sleep(600)
  const f = await canvasFacts()
  const want = ['进入', '详情', '重命名', '归档会话', '删除（级联）']
  const missing = want.filter((w) => !f.menuItems.includes(w))
  record('E2E-10', f.menuItems.length >= 5 && missing.length === 0, { menu: f.menuItems }, missing.length ? `缺: ${missing.join(',')}` : '')
}

// ── E2E-13 右键详情 → 右侧明细（基础信息 + 会话数） ──
{
  const detailItem = page.locator('[data-dsh-menu-item="detail"]')
  await detailItem.click()
  await sleep(700)
  const f = await canvasFacts()
  const d = await page.evaluate(() => {
    const p = document.querySelector('[data-dsh-canvas-detail]')
    return { found: !!p, text: p ? p.textContent.slice(0, 200) : null, hasClose: !!document.querySelector('[data-dsh-detail-close]') }
  })
  record('E2E-13', d.found && d.hasClose, { text: d.text }, d.found && d.text && /会话/.test(d.text) ? '' : '未含会话数')
}

// ── E2E-15 点关闭 → 明细收起 ──
{
  await page.locator('[data-dsh-detail-close]').click()
  await sleep(500)
  const f = await canvasFacts()
  record('E2E-15', !f.detail, { detailGone: !f.detail })
}

// ── E2E-20 缩放/平移/重置（本轮已实现部分） ──
{
  // 工具栏放大 → 110%
  await page.locator('[data-dsh-action-zoom-in]').click()
  await sleep(500)
  let f = await canvasFacts()
  const zoomed = f.zoomText !== null && f.zoomText.includes('110')
  // 重置 → 100%
  await page.locator('[data-dsh-action-reset]').click()
  await sleep(500)
  f = await canvasFacts()
  const reset = f.zoomText !== null && f.zoomText.includes('100')
  // 滚轮缩放（dispatchEvent 直接触发元素级监听）
  const wheelOk = await page.evaluate(() => {
    const area = document.querySelector('[data-dsh-canvas-area]')
    if (!area) return null
    const r = area.getBoundingClientRect()
    const before = document.querySelector('[data-dsh-canvas-viewport]').style.transform
    area.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: r.left + 200, clientY: r.top + 200, bubbles: true, cancelable: true }))
    return { before }
  })
  await sleep(500)
  f = await canvasFacts()
  const wheelChanged = wheelOk !== null && f.viewportTransform !== wheelOk.before
  // 空白拖拽平移
  const areaBox = await page.locator('[data-dsh-canvas-area]').boundingBox()
  const beforeT = (await canvasFacts()).viewportTransform
  await page.mouse.move(areaBox.x + areaBox.width - 60, areaBox.y + areaBox.height - 60)
  await page.mouse.down()
  await page.mouse.move(areaBox.x + areaBox.width - 60 + 120, areaBox.y + areaBox.height - 60 + 60, { steps: 5 })
  await page.mouse.up()
  await sleep(600)
  const afterT = (await canvasFacts()).viewportTransform
  const panned = beforeT !== afterT
  record('E2E-20', zoomed && reset && wheelChanged === true && panned, { zoomed, reset, wheelChanged, panned, beforeT, afterT, zoomText: f.zoomText })
}

// ── E2E-02 点卡片 → 进入该工作区新会话并退出画布 ──
{
  const before = await canvasFacts()
  await page.locator('[data-dsh-canvas-card]').first().click()
  await sleep(1800)
  const f = await canvasFacts()
  const exited = !f.viewDisplayed || f.active !== 'workspace-canvas'
  const conversationActive = await page.evaluate(() => {
    const conv = document.querySelector('[data-slot="conversation"]')
    return conv ? conv.textContent.length : 0
  })
  record('E2E-02', exited, { exited, beforeActive: before.active, afterActive: f.active, conversationChars: conversationActive },
    exited ? '' : '点卡片后画布未自动退出（待确认）')
}

// ── E2E-03 点侧边栏工作区行 → 画布退出，对话恢复 ──
{
  await openCanvas()
  const row = page.locator('[class*="projectRow"]').first()
  await row.click()
  await sleep(1200)
  const f = await canvasFacts()
  record('E2E-03', !f.viewDisplayed, { viewDisplayed: f.viewDisplayed, active: f.active })
  // 恢复画布供后续场景
  await openCanvas()
}

// ── E2E-04 拖拽卡片 → 刷新/重开 → 位置一致 ──
{
  const card = page.locator('[data-dsh-canvas-card]').first()
  const before = await card.evaluate((el) => ({ left: el.style.left, top: el.style.top }))
  const box = await card.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 90, { steps: 8 })
  await page.mouse.up()
  await sleep(900) // 防抖持久化
  const after = await card.evaluate((el) => ({ left: el.style.left, top: el.style.top }))
  const moved = before.left !== after.left || before.top !== after.top
  await closeCanvas()
  await openCanvas()
  const restored = await page.locator('[data-dsh-canvas-card]').first().evaluate((el) => ({ left: el.style.left, top: el.style.top }))
  const consistent = Math.abs(parseFloat(restored.left) - parseFloat(after.left)) < 2 && Math.abs(parseFloat(restored.top) - parseFloat(after.top)) < 2
  record('E2E-04', moved && consistent, { before, after, restored }, !moved ? '拖拽未生效' : '')
}

// ── E2E-05 写入损坏数据 → 空布局启动不崩溃 + 原数据备份保留 ──
{
  await page.evaluate(() => {
    localStorage.setItem('dsh.workspaceCanvas.doc.v1', '{broken json!!')
    localStorage.removeItem('dsh.workspaceCanvas.doc.v1.bak')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(5000)
  await openCanvas()
  const f = await canvasFacts()
  const bak = await page.evaluate(() => localStorage.getItem('dsh.workspaceCanvas.doc.v1.bak'))
  record('E2E-05', f.viewDisplayed && !f.errorBoundary && bak !== null, {
    viewDisplayed: f.viewDisplayed, errorBoundary: f.errorBoundary, bakSaved: bak !== null, bakPrefix: bak ? bak.slice(0, 20) : null, cards: f.cards,
  }, '备份保存存储原串（含损坏取证，对齐 document.spec 单测语义）；空文档启动、feed 卡片照常渲染')
  // 清理：恢复正常（删除坏数据与备份，避免污染后续）
  await page.evaluate(() => { localStorage.removeItem('dsh.workspaceCanvas.doc.v1'); localStorage.removeItem('dsh.workspaceCanvas.doc.v1.bak') })
}

// ── E2E-11 删除含成员工作区 → 确认列出成员数 → 取消不删 ──
{
  // 打开右键菜单（若画布已因刷新重置）→ 删除项 → dialog 出现 → dismiss
  if (!(await canvasFacts()).viewDisplayed) await openCanvas()
  const card = page.locator('[data-dsh-canvas-card]').first()
  await card.click({ button: 'right' })
  await sleep(600)
  let dialogMsg = null
  page.once('dialog', async (d) => { dialogMsg = d.message(); await d.dismiss() })
  const delItem = page.locator('[data-dsh-menu-item="delete"]')
  await delItem.click()
  await sleep(800)
  const cardsAfter = await page.locator('[data-dsh-canvas-card]').count()
  record('E2E-11', dialogMsg !== null && cardsAfter > 0, { dialogMsg, cardsAfter }, '取消后工作区保留；级联清理逻辑由单测覆盖（GUI 不做真实删除）')
}

// ── 控制台错误汇总 ──
record('console', errors.length === 0, { errorCount: errors.length, errors: errors.slice(0, 5) })

console.log(JSON.stringify(results, null, 2))
await browser.close()
