/**
 * dsh-hello 互斥测试面板（T029）。
 *
 * 参与单一激活标记协议（@hundun/dsh-panel-protocol）的简单中间区域面板：
 * 面板名 `hello-panel`；打开 → 写标记 + 广播（后写者胜）；收到其他面板
 * 激活 → 让位关闭。作为画布互斥验收的对方面板（clarify Q3，可随意改动）。
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ACTIVE_ATTR, PANELS, activate, isActive, onOtherActivate } from '@hundun/dsh-panel-protocol'

const OWN = PANELS.helloPanel
const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"]'

const PANEL_STYLE = `
[data-dsh-hello-panel] {
  position: absolute;
  inset: 0;
  display: none;
  z-index: 59;
  background: var(--dsw-alias-bg-base, #fff);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
}
html[data-dsh-panel-active="hello-panel"] [data-dsh-hello-panel] { display: flex; }
`

/** 面板内容（问候语 + 关闭按钮）。 */
function HelloPanelBody({ onClose }: { onClose(): void }) {
  return createElement(
    'div',
    { 'data-dsh-hello-panel-body': '', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 } },
    [
      createElement('div', { key: 'greet', style: { fontSize: 16 } }, '你好，来自 hundun-dsh 的问候！'),
      createElement(
        'button',
        { key: 'close', type: 'button', onClick: onClose, style: { border: '1px solid var(--dsw-alias-border-l2, #ccc)', background: 'transparent', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' } },
        '关闭面板',
      ),
    ],
  )
}

/** 互斥测试面板控制器（协议接入 + 中间区域覆盖）。 */
export class HelloPanelController {
  private opened = false
  private container: HTMLDivElement | undefined
  private root: Root | undefined
  private styleTag: HTMLStyleElement | undefined
  private disposeOther: (() => void) | undefined
  private observer: MutationObserver | undefined

  start(): void {
    this.disposeOther = onOtherActivate(OWN, () => this.close())
    this.injectStyle()
    this.observer = new MutationObserver(() => this.ensure())
    this.observer.observe(document.body, { childList: true, subtree: true })
    this.ensure()
  }

  toggle(): void {
    if (this.opened) this.close()
    else this.open()
  }

  open(): void {
    this.opened = true
    activate(OWN)
    this.ensure()
  }

  close(): void {
    if (!this.opened) return
    this.opened = false
    if (isActive(OWN)) document.documentElement.removeAttribute(ACTIVE_ATTR)
  }

  getSnapshot(): { open: boolean } {
    return { open: this.opened }
  }

  dispose(): void {
    this.disposeOther?.()
    this.disposeOther = undefined
    this.observer?.disconnect()
    this.observer = undefined
    if (isActive(OWN)) document.documentElement.removeAttribute(ACTIVE_ATTR)
    this.root?.unmount()
    this.root = undefined
    this.container?.remove()
    this.container = undefined
    this.styleTag?.remove()
    this.styleTag = undefined
  }

  private ensure(): void {
    if (this.container !== undefined) {
      if (this.container.isConnected) return
      this.root?.unmount()
      this.root = undefined
      this.container.remove()
      this.container = undefined
    }
    const column = document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR)
    if (column === null) return
    this.container = document.createElement('div')
    this.container.dataset.dshHelloPanel = ''
    column.appendChild(this.container)
    this.root = createRoot(this.container)
    this.root.render(createElement(HelloPanelBody, { onClose: () => this.close() }))
  }

  private injectStyle(): void {
    const id = 'dsh-hello-panel'
    const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${id}"]`)
    if (existing !== null) return
    const tag = document.createElement('style')
    tag.dataset.plugin = id
    tag.dataset.pluginCss = id
    tag.textContent = PANEL_STYLE
    document.head.appendChild(tag)
    this.styleTag = tag
  }
}
