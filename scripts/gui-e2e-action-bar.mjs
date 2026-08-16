/** E2E：操作栏（缩放整合/自动布局/聚焦）+ UI 一致性真机验证。 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const b = await chromium.launch({ headless: true })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await p.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded', timeout: 30000 })
await p.waitForTimeout(5000)
await p.locator('[data-dsh-canvas-entry]').first().click()
await p.waitForTimeout(1500)

const R = []
const rec = (id, pass, detail) => R.push({ id, pass: pass ? 'PASS' : 'FAIL', detail })

// E2E-01 操作栏出现 + 右上角无独立缩放工具
const bar = await p.evaluate(() => ({
  bar: !!document.querySelector('[data-dsh-action-bar]'),
  oldToolbar: !!document.querySelector('[data-dsh-canvas-toolbar]'),
  zoomOut: !!document.querySelector('[data-dsh-action-zoom-out]'),
  percent: document.querySelector('[data-dsh-action-zoom-percent]')?.textContent,
  zoomIn: !!document.querySelector('[data-dsh-action-zoom-in]'),
  reset: !!document.querySelector('[data-dsh-action-reset]'),
  layout: !!document.querySelector('[data-dsh-action-layout]'),
  focus: !!document.querySelector('[data-dsh-action-focus]'),
  barStyle: document.querySelector('[data-dsh-action-bar]')?.getAttribute('style'),
}))
rec('E2E-01', bar.bar && !bar.oldToolbar && bar.zoomIn && bar.zoomOut && bar.reset && bar.layout && bar.focus, bar)

// E2E-02 放大 110%
await p.locator('[data-dsh-action-zoom-in]').click()
await p.waitForTimeout(400)
const percent1 = await p.locator('[data-dsh-action-zoom-percent]').textContent()
rec('E2E-02', percent1.includes('110'), { percent1 })

// E2E-03 重置 → 100%
await p.locator('[data-dsh-action-reset]').click()
await p.waitForTimeout(400)
const percent2 = await p.locator('[data-dsh-action-zoom-percent]').textContent()
const resetOk = await p.evaluate(() => {
  const v = document.querySelector('[data-dsh-canvas-viewport]')
  return v ? v.style.transform : null
})
rec('E2E-03', percent2.includes('100') && resetOk === 'translate(0px, 0px) scale(1)', { percent2, resetOk })

// E2E-04 拖拽卡片经过操作栏附近（卡片不被拦截）
const box = await p.locator('[data-dsh-canvas-card]').first().boundingBox()
const barBox = await p.locator('[data-dsh-action-bar]').boundingBox()
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await p.mouse.down()
await p.mouse.move(barBox.x + 20, barBox.y + 10, { steps: 6 }) // 拖到操作栏区域
await p.mouse.up()
await p.waitForTimeout(400)
const dragAfter = await p.locator('[data-dsh-canvas-card]').first().evaluate((el) => ({ left: el.style.left, top: el.style.top }))
rec('E2E-04', dragAfter.left !== '12px' || dragAfter.top !== '12px', { dragAfter })

// E2E-05 UI 一致性（无硬编码颜色）
const styleCheck = await p.evaluate(() => {
  const s = document.querySelector('[data-dsh-action-bar]')?.getAttribute('style') ?? ''
  return { hasHex: /#[0-9a-fA-F]{3,6}/.test(s), usesTokens: s.includes('var(--dsw-alias-') }
})
rec('E2E-05', !styleCheck.hasHex && styleCheck.usesTokens, styleCheck)

// E2E-06 自动布局：先拖乱第一张卡，点自动布局 → 回 GRID
const cardBefore = await p.locator('[data-dsh-canvas-card]').first().evaluate((el) => ({ left: el.style.left, top: el.style.top }))
await p.locator('[data-dsh-action-layout]').click()
await p.waitForTimeout(600)
const cardAfter = await p.locator('[data-dsh-canvas-card]').first().evaluate((el) => ({ left: el.style.left, top: el.style.top }))
const allOnGrid = await p.evaluate(() => {
  const GRID_X = [12, 228, 444]
  const GRID_Y = [12, 124]
  return [...document.querySelectorAll('[data-dsh-canvas-card]')].every((el) => {
    const x = parseFloat(el.style.left); const y = parseFloat(el.style.top)
    return GRID_X.includes(x) && GRID_Y.includes(y)
  })
})
rec('E2E-06', allOnGrid && cardAfter.left === '12px' && cardAfter.top === '12px', { cardBefore, cardAfter, allOnGrid })

// E2E-08 自动布局持久化（刷新后保留）
const posBeforeReload = await p.evaluate(() => [...document.querySelectorAll('[data-dsh-canvas-card]')].map((el) => el.style.left + ',' + el.style.top))
await p.reload({ waitUntil: 'domcontentloaded' })
await p.waitForTimeout(5000)
await p.locator('[data-dsh-canvas-entry]').first().click()
await p.waitForTimeout(1500)
const posAfterReload = await p.evaluate(() => [...document.querySelectorAll('[data-dsh-canvas-card]')].map((el) => el.style.left + ',' + el.style.top))
rec('E2E-08', JSON.stringify(posBeforeReload) === JSON.stringify(posAfterReload), { posBeforeReload, posAfterReload })

// E2E-10/11 聚焦：先平移到远处，聚焦第一个工作区 → 卡片居中可见 + zoom 不变
const zoomBefore = await p.evaluate(() => {
  const v = document.querySelector('[data-dsh-canvas-viewport]')
  return v ? v.style.transform : null
})
// 空白拖拽平移（往左上拖，远离目标）
const area = await p.locator('[data-dsh-canvas-area]').boundingBox()
await p.mouse.move(area.x + area.width - 80, area.y + area.height - 80)
await p.mouse.down()
await p.mouse.move(area.x + area.width - 80 + 300, area.y + area.height - 80 + 200, { steps: 5 })
await p.mouse.up()
await p.waitForTimeout(400)
// 聚焦第一个
await p.locator('[data-dsh-action-focus]').click()
await p.waitForTimeout(500)
const menuItems = await p.locator('[data-dsh-action-focus-menu] button').count()
await p.locator('[data-dsh-action-focus-menu] button').first().click()
await p.waitForTimeout(600)
const focusResult = await p.evaluate(() => {
  const card = document.querySelector('[data-dsh-canvas-card]')
  const v = document.querySelector('[data-dsh-canvas-viewport]')
  return {
    cardRect: card ? card.getBoundingClientRect().toJSON() : null,
    areaRect: document.querySelector('[data-dsh-canvas-area]').getBoundingClientRect().toJSON(),
    viewTransform: v ? v.style.transform : null,
  }
})
const cardCentered = focusResult.cardRect
  && Math.abs((focusResult.cardRect.x + focusResult.cardRect.width / 2) - (focusResult.areaRect.x + focusResult.areaRect.width / 2)) < 10
  && Math.abs((focusResult.cardRect.y + focusResult.cardRect.height / 2) - (focusResult.areaRect.y + focusResult.areaRect.height / 2)) < 10
const zoomKept = focusResult.viewTransform && focusResult.viewTransform.includes('scale(1)')
rec('E2E-10/11', cardCentered && zoomKept, { menuItems, cardCentered, zoomKept, viewTransform: focusResult.viewTransform })

rec('console', errors.length === 0, { errors: errors.slice(0, 4) })
console.log(JSON.stringify(R, null, 2))
await b.close()
