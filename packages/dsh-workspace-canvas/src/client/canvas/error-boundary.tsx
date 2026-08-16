/**
 * CanvasView 错误边界（T035）：渲染抛错 → 兜底提示而非白屏。
 */
import { Component, createElement } from 'react'
import type { ReactNode } from 'react'

export interface CanvasErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface CanvasErrorBoundaryState {
  error: Error | null
}

/** 画布渲染错误边界：子组件抛错时显示兜底，不拖垮 GUI。 */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return this.props.fallback ?? createElement(
        'div',
        { role: 'alert', 'data-dsh-canvas-error': '', style: { padding: 24, fontSize: 13, color: 'var(--dsw-alias-state-danger)' } },
        '画布渲染出错，请关闭后重新打开。',
      )
    }
    return this.props.children
  }
}
