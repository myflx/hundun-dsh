/**
 * 工作区展示标题计算契约测试（003-detail-panel-redesign 补充）。
 *
 * 验证未命名工作区的默认标题 = 路径文件夹名；路径缺失才回退「未命名工作区」。
 */
import { describe, expect, it } from 'vitest'
import { folderName, UNNAMED_WORKSPACE, workspaceDisplayTitle } from '../src/client/canvas/detail/workspace-title.ts'

describe('folderName（取路径文件夹名）', () => {
  it('Unix 路径取最后一段', () => {
    expect(folderName('/home/user/proj')).toBe('proj')
  })
  it('Windows 路径取最后一段', () => {
    expect(folderName('C:\\Users\\me\\workspace')).toBe('workspace')
  })
  it('尾部斜杠 / 空路径 / 纯斜杠均返回空', () => {
    expect(folderName('/home/user/proj/')).toBe('proj')
    expect(folderName('')).toBe('')
    expect(folderName('/')).toBe('')
    expect(folderName('\\\\')).toBe('')
  })
})

describe('workspaceDisplayTitle（未命名工作区默认标题）', () => {
  it('自定义标题优先（含空白 trim）', () => {
    expect(workspaceDisplayTitle('我的项目', '/any/path')).toBe('我的项目')
    expect(workspaceDisplayTitle('  我的项目  ', '/any/path')).toBe('我的项目')
  })
  it('无标题时用路径文件夹名', () => {
    expect(workspaceDisplayTitle('', '/home/user/proj')).toBe('proj')
    expect(workspaceDisplayTitle('   ', 'C:\\Users\\me\\workspace')).toBe('workspace')
  })
  it('无标题且无路径时回退「未命名工作区」', () => {
    expect(workspaceDisplayTitle('', '')).toBe(UNNAMED_WORKSPACE)
    expect(workspaceDisplayTitle('', '/')).toBe(UNNAMED_WORKSPACE)
  })
})
