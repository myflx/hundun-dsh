/** E2E（v2）：操作栏四按钮（缩小/重置/放大/刷新，hundun-web 对齐）+ UI 一致性真机验证。 */
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

// E2E-01 四图标按钮顺序 + 无文字 + 右上角无独立缩放工具
const order = await p.evaluate(() => {
  const bar = document.querySelector('[data-dsh-action-bar]')
  const btns = bar ? [...bar.querySelectorAll('button')].map((btn) => {
    if (btn.hasAttribute('data-dsh-action-zoom-out')) return 'zoom-out'
    if (btn.hasAttribute('data-dsh-action-reset')) return 'reset'
    if (btn.hasAttribute('data-dsh-action-zoom-in')) return 'zoom-in'
    if (btn.hasAttribute('data-dsh-action-refresh')) return 'refresh'
    return '?'
  }) : []
  return {
    bar: !!bar,
    order: btns,
    hasSvg: bar ? bar.querySelectorAll('button svg').length : 0,
    allIconOnly: bar ? [...bar.querySelectorAll('button')].every((b) => (b.textContent ?? '').trim() === '') : false,
    oldToolbar: !!document.querySelector('[data-dsh-canvas-toolbar]'),
  }
})
rec('E2E-01', order.bar && JSON.stringify(order.order) === JSON.stringify(['zoom-out', 'reset', 'zoom-in', 'refresh']) && order.hasSvg === 4 && order.allIconOnly && !order.oldToolbar, order)

// E2E-02 放大 110% → 缩小 99%（viewport transform）
const vpTransform = () => p.evaluate(() => document.querySelector('[data-dsh-canvas-viewport]')?.style.transform)
const t0 = await vpTransform()
await p.locator('[data-dsh-action-zoom-in]').click()
await p.waitForTimeout(300)
const t1 = await vpTransform()
await p.locator('[data-dsh-action-zoom-out]').click()
await p.waitForTimeout(300)
const t2 = await vpTransform()
rec('E2E-02', t0 !== t1 && t1.includes('scale(1.1') && t2.includes('scale(0.99'), { t0, t1, t2 })

// E2E-03 重置 → 100% + 原点
await p.locator('[data-dsh-action-reset]').click()
await p.waitForTimeout(300)
const resetOk = await vpTransform()
rec('E2E-03', resetOk === 'translate(0px, 0px) scale(1)', { resetOk })

// E2E-04/05 刷新 → 无报错（基线重拉由 workspaces 服务处理，feed 无变化时画布稳定）
await p.locator('[data-dsh-action-refresh]').click()
await p.waitForTimeout(800)
const afterRefresh = await p.evaluate(() => ({
  cards: document.querySelectorAll('[data-dsh-canvas-card]').length,
  bar: !!document.querySelector('[data-dsh-action-bar]'),
}))
rec('E2E-04', afterRefresh.cards > 0 && afterRefresh.bar, afterRefresh)

// E2E-06 拖拽卡片经过操作栏附近 → 不拦截
const box = await p.locator('[data-dsh-canvas-card]').first().boundingBox()
const barBox = await p.locator('[data-dsh-action-bar]').boundingBox()
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await p.mouse.down()
await p.mouse.move(barBox.x + 10, barBox.y + 5, { steps: 6 })
await p.mouse.up()
await p.waitForTimeout(300)
const dragAfter = await p.locator('[data-dsh-canvas-card]').first().evaluate((el) => el.style.left + ',' + el.style.top)
rec('E2E-06', dragAfter !== '12px,12px', { dragAfter })

// E2E-07 UI 一致性（无硬编码颜色）
const styleCheck = await p.evaluate(() => {
  const s = document.querySelector('[data-dsh-action-bar]')?.getAttribute('style') ?? ''
  return { hasHex: /#[0-9a-fA-F]{3,6}/.test(s), usesTokens: s.includes('var(--dsw-alias-') }
})
rec('E2E-07', !styleCheck.hasHex && styleCheck.usesTokens, styleCheck)

rec('E2E-08', errors.length === 0, { errors: errors.slice(0, 4) })
console.log(JSON.stringify(R, null, 2))
await b.close()
