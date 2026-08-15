import { describe, expect, it } from 'vitest'
import { greet } from '../src/greet.ts'

describe('greet', () => {
  it('默认问候指向 hundun-dsh', () => {
    expect(greet()).toContain('hundun-dsh')
  })

  it('可指定名字', () => {
    expect(greet('Alice')).toContain('Alice')
  })
})
