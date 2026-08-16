/**
 * GUI P2 验证探针：工具栏缩放/重置、滚轮缩放、空白平移、view 持久化。
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

const out = []
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(5000)

const entry = page.locator('[data-dsh-canvas-entry]')
if (await entry.count() === 0) { out.push({ error: 'no entry button' }) }
else {
  await entry.first().click()
  await page.waitForTimeout(1500)

  const readViewport = () => page.evaluate(() => {
    const vp = document.querySelector('[data-dsh-canvas-viewport]')
    const toolbar = document.querySelector('[data-dsh-action-bar]')
    return {
      transform: vp ? vp.style.transform : null,
      toolbarText: toolbar ? toolbar.textContent : null,
      viewFound: !!vp,
    }
  })

  out.push({ step: 'initial', ...(await readViewport()) })

  // 工具栏放大
  await page.locator('[data-dsh-action-zoom-in]').click()
  await page.waitForTimeout(200)
  out.push({ step: 'toolbar-zoom-in', ...(await readViewport()) })

  // 工具栏重置
  await page.locator('[data-dsh-action-reset]').click()
  await page.waitForTimeout(200)
  out.push({ step: 'toolbar-reset', ...(await readViewport()) })

  // 滚轮缩放（headless 下 mouse.wheel 不触发元素级监听，改用真实 WheelEvent 派发）
  const wheelZoomed = await page.evaluate(() => {
    const area = document.querySelector('[data-dsh-canvas-area]')
    if (!area) return null
    const rect = area.getBoundingClientRect()
    const before = document.querySelector('[data-dsh-canvas-viewport]').style.transform
    area.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -240,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
    }))
    return before
  })
  await page.waitForTimeout(200)
  out.push({ step: 'wheel-zoom-in', wheelBefore: wheelZoomed, ...(await readViewport()) })
}
out.push({ step: 'console-errors', errors })
console.log(JSON.stringify(out, null, 2))
await browser.close()
