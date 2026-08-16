/**
 * 探测 loader 内部结构与 hundun 相关 UI 标记（bundle 加载检查 v2）。
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)

const facts = await page.evaluate(() => {
  const out = { loaderProto: [], loaderOwn: [], hundunAttrs: [], hundunText: [] }
  const L = window.__ModuleLoader__
  if (L) {
    out.loaderOwn = Object.getOwnPropertyNames(L)
    let p = Object.getPrototypeOf(L)
    while (p && p !== Object.prototype) {
      out.loaderProto.push(Object.getOwnPropertyNames(p))
      p = Object.getPrototypeOf(p)
    }
  }
  document.querySelectorAll('*').forEach((el) => {
    for (const a of el.attributes) {
      if (a.name.toLowerCase().includes('hundun') || (a.value && String(a.value).toLowerCase().includes('hundun'))) {
        out.hundunAttrs.push(a.name + '=' + String(a.value).slice(0, 100))
      }
    }
    const t = (el.textContent || '').trim()
    if (t && t.length < 60 && /hundun|canvas|hello|演示|demo/i.test(t)) out.hundunText.push(el.tagName + ':' + t.slice(0, 60))
  })
  return out
})
console.log(JSON.stringify({ facts, errors: errors.slice(0, 10) }, null, 2))
await browser.close()
