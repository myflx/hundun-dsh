import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasErrorBoundary } from '../src/client/canvas/error-boundary.tsx'

function Bomb(): never {
  throw new Error('boom')
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CanvasErrorBoundary（T035）', () => {
  it('子组件抛错 → 显示兜底而非白屏', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasErrorBoundary, null, createElement(Bomb)))
    })
    expect(container.querySelector('[data-dsh-canvas-error]')).not.toBeNull()
    expect(container.textContent).toContain('画布渲染出错')
    await act(async () => root.unmount())
  })

  it('正常子组件不受影响', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(CanvasErrorBoundary, null, createElement('div', null, 'OK')))
    })
    expect(container.textContent).toBe('OK')
    await act(async () => root.unmount())
  })
})
