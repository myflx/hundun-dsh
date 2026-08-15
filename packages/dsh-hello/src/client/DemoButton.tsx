/**
 * 侧边栏底部问候按钮（槽位 owner 传入列状态 wide）。
 * 模板用内联样式保持零依赖；真实插件请改用 CSS Modules（*.module.css）。
 */
export interface DemoButtonProps {
  /** 侧边栏是否宽栏渲染（false = 56px 窄轨）。 */
  wide: boolean
}

export function DemoButton({ wide }: DemoButtonProps) {
  return (
    <button
      type="button"
      title="hundun-dsh 问候"
      onClick={() => window.alert('你好，来自 hundun-dsh 的问候！')}
      style={{
        margin: '0 4px',
        padding: '4px 8px',
        border: 'none',
        borderRadius: 6,
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      👋{wide ? ' 问候' : ''}
    </button>
  )
}
