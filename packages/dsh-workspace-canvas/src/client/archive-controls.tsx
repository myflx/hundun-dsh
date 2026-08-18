import { createElement } from 'react'
import type { AutoArchiveConfig, IdleUnit } from './archive-store.ts'

export type ArchivePolicyPatch = Partial<Pick<AutoArchiveConfig, 'enabled' | 'idleDays' | 'idleUnit' | 'maxSessions'>>

export interface ArchivePolicyFieldsProps {
  config: Partial<AutoArchiveConfig>
  onPatch: (patch: ArchivePolicyPatch) => void
  /** global = settings page selectors, workspace = detail panel selectors. */
  dataPrefix: 'global' | 'workspace'
  showStatus?: boolean
}

const FIELD: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }
const FIELD_LABEL: React.CSSProperties = { width: 76, flex: '0 0 auto' }
const INPUT: React.CSSProperties = { width: 70, padding: '4px 7px', fontSize: 13 }
const SELECT: React.CSSProperties = { padding: '4px 6px', fontSize: 13 }
const STATUS_DESC: React.CSSProperties = { display: 'block', marginTop: 3, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }

function attr(prefix: string, name: string): Record<string, string> {
  return { [`${prefix}-${name}`]: '' }
}

/** Shared archive policy controls used by global settings and workspace details. */
export function ArchivePolicyFields({ config, onPatch, dataPrefix, showStatus = true }: ArchivePolicyFieldsProps) {
  const prefix = dataPrefix === 'global' ? 'data-dsh-archive' : 'data-dsh-ws-archive'
  const enabled = config.enabled ?? false
  const idleDays = config.idleDays ?? 30
  const idleUnit = config.idleUnit ?? 'day'
  const maxSessions = config.maxSessions ?? 30
  const limited = maxSessions > 0
  const buttonStyle = (active: boolean, withBorder = false): React.CSSProperties => ({
    border: 0,
    borderLeft: withBorder ? '1px solid var(--dsw-alias-border-l2)' : 0,
    padding: '5px 10px',
    color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)',
    background: active ? 'var(--dsw-alias-fill-brand)' : 'transparent',
    cursor: 'pointer',
    fontSize: 12,
  })

  return createElement('div', { 'data-dsh-archive-policy': dataPrefix }, [
    showStatus
      ? createElement('div', { key: 'status', style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 32, fontSize: 13 } }, [
        createElement('span', { key: 'label', style: { flex: 1 } }, [
          createElement('span', { key: 'name', style: { display: 'block' } }, '状态'),
          createElement('span', { key: 'desc', style: STATUS_DESC }, enabled ? '达到策略后自动归档闲置会话' : '当前不会自动归档会话'),
        ]),
        createElement('input', {
          key: 'input',
          type: 'checkbox',
          ...attr(prefix, 'enabled'),
          checked: enabled,
          onChange: () => onPatch({ enabled: !enabled }),
          style: { position: 'absolute', opacity: 0, pointerEvents: 'none' },
        }),
        createElement('div', { key: 'segmented', role: 'group', 'aria-label': '自动归档状态', style: { display: 'flex', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 5, overflow: 'hidden' } }, [
          createElement('button', { key: 'off', type: 'button', ...attr(prefix, 'enabled-off'), 'aria-pressed': !enabled, onClick: () => onPatch({ enabled: false }), style: buttonStyle(!enabled) }, '关闭'),
          createElement('button', { key: 'on', type: 'button', ...attr(prefix, 'enabled-on'), 'aria-pressed': enabled, onClick: () => onPatch({ enabled: true }), style: buttonStyle(enabled, true) }, '开启'),
        ]),
      ])
      : null,
    enabled
      ? createElement('div', { key: 'policy', [`${prefix}-policy-fields`]: '', style: { marginTop: showStatus ? 14 : 0, paddingTop: showStatus ? 12 : 0, borderTop: showStatus ? '1px solid var(--dsw-alias-border-l2)' : 0 } }, [
        createElement('div', { key: 'policy-title', style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)' } }, '归档策略'),
        createElement('div', { key: 'idle', style: FIELD }, [
          createElement('span', { key: 'label', style: FIELD_LABEL }, '闲置超过'),
          createElement('input', {
            key: 'input',
            type: 'number',
            min: 1,
            ...attr(prefix, 'idle-days'),
            value: idleDays,
            onChange: (event) => onPatch({ idleDays: Number(event.currentTarget.value) || 1 }),
            style: INPUT,
          }),
          createElement('select', {
            key: 'unit',
            ...attr(prefix, 'idle-unit'),
            value: idleUnit,
            onChange: (event: { currentTarget: { value: string } }) => onPatch({ idleUnit: event.currentTarget.value as IdleUnit }),
            style: SELECT,
          }, [
            createElement('option', { key: 'day', value: 'day' }, '天'),
            createElement('option', { key: 'hour', value: 'hour' }, '小时'),
            createElement('option', { key: 'minute', value: 'minute' }, '分钟'),
          ]),
        ]),
        createElement('div', { key: 'max', [`${prefix}-max-sessions-mode`]: limited ? 'limited' : 'unlimited', style: { ...FIELD, alignItems: 'flex-start' } }, [
          createElement('span', { key: 'label', style: { ...FIELD_LABEL, paddingTop: 5 } }, '会话数量上限'),
          createElement('div', { key: 'control', style: { flex: 1, minWidth: 0 } }, [
            createElement('div', { key: 'segmented', role: 'group', 'aria-label': '会话数量上限', style: { display: 'flex', width: 'max-content', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 5, overflow: 'hidden' } }, [
              createElement('button', { key: 'unlimited', type: 'button', ...attr(prefix, 'max-sessions-unlimited'), 'aria-pressed': !limited, onClick: () => onPatch({ maxSessions: 0 }), style: buttonStyle(!limited) }, '不限'),
              createElement('button', { key: 'limited', type: 'button', ...attr(prefix, 'max-sessions-limited'), 'aria-pressed': limited, onClick: () => onPatch({ maxSessions: maxSessions > 0 ? maxSessions : 30 }), style: buttonStyle(limited, true) }, '限制'),
            ]),
            limited
              ? createElement('div', { key: 'input-row', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } }, [
                createElement('input', {
                  key: 'input',
                  type: 'number',
                  min: 1,
                  ...attr(prefix, 'max-sessions'),
                  value: maxSessions,
                  onChange: (event) => onPatch({ maxSessions: Math.max(1, Number(event.currentTarget.value) || 1) }),
                  style: INPUT,
                }),
                createElement('span', { key: 'unit', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, '个会话'),
              ])
              : createElement('span', { key: 'hint', style: { display: 'block', marginTop: 7, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, '不按会话数量限制'),
          ]),
        ]),
      ])
      : null,
  ].filter(Boolean))
}
