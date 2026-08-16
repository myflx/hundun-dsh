/**
 * 侧边栏底部问候按钮（槽位 owner 传入列状态 wide；apply 经 slots 注入 togglePanel）。
 * 点击：切换互斥测试面板（T029）；无注入时退回问候 alert。
 */
export interface DemoButtonProps {
  /** 侧边栏是否宽栏渲染（false = 56px 窄轨）。 */
  wide: boolean
  /** 注入的测试面板切换（apply 提供；缺省 = 问候 alert）。 */
  togglePanel?: () => void
}

export function DemoButton({ wide, togglePanel }: DemoButtonProps) {
  return (
    <button
      type="button"
      title="hundun-dsh 问候"
      onClick={() => {
        if (togglePanel !== undefined) togglePanel()
        else window.alert('你好，来自 hundun-dsh 的问候！')
      }}
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
