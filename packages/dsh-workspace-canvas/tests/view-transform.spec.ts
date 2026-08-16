import { describe, expect, it } from 'vitest'
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  defaultView,
  panBy,
  resetView,
  scenePoint,
  screenPoint,
  wheelZoomFactor,
  zoomAt,
  type ViewTransform,
} from '../src/client/canvas/view-transform.ts'

describe('view 变换（P2）', () => {
  it('clampZoom 夹取到 [0.3, 3]', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN)
    expect(clampZoom(5)).toBe(ZOOM_MAX)
    expect(clampZoom(1.5)).toBe(1.5)
    expect(clampZoom(Number.NaN)).toBe(1)
  })

  it('zoomAt 以指针为锚：缩放后指针所指 scene 点不变', () => {
    const view: ViewTransform = { x: 10, y: 20, zoom: 1 }
    const pointer = { x: 100, y: 80 }
    const before = scenePoint(view, pointer)
    const next = zoomAt(view, 2, pointer)
    expect(next.zoom).toBe(2)
    // 缩放后同一指针位置仍指向同一 scene 点
    const after = scenePoint(next, pointer)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('zoomAt 缩放值被夹取', () => {
    const next = zoomAt(defaultView(), 10, { x: 0, y: 0 })
    expect(next.zoom).toBe(ZOOM_MAX)
    const min = zoomAt(defaultView(), 0.01, { x: 0, y: 0 })
    expect(min.zoom).toBe(ZOOM_MIN)
  })

  it('panBy 平移视图', () => {
    const next = panBy({ x: 0, y: 0, zoom: 1 }, 15, -5)
    expect(next).toEqual({ x: 15, y: -5, zoom: 1 })
  })

  it('scenePoint / screenPoint 互逆', () => {
    const view: ViewTransform = { x: 30, y: -10, zoom: 1.5 }
    const client = { x: 210, y: 65 }
    const scene = scenePoint(view, client)
    const back = screenPoint(view, scene)
    expect(back.x).toBeCloseTo(client.x, 6)
    expect(back.y).toBeCloseTo(client.y, 6)
  })

  it('resetView 返回 identity', () => {
    expect(resetView()).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('wheelZoomFactor：上滚放大 1.1 / 下滚缩小 0.9', () => {
    expect(wheelZoomFactor(-100)).toBe(1.1)
    expect(wheelZoomFactor(100)).toBe(0.9)
  })
})
