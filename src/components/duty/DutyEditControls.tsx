import { useEffect, useRef } from 'react'
import type { User } from '../../types'

type DialogState =
  | { kind: 'info'; title: string; message: string }
  | { kind: 'confirm'; title: string; message: string; items?: string[] }

export type { DialogState }
export type DutyEditorUser = User

export function DutyEditBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  hint,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  hint?: string
}) {
  return (
    <div className={`duty-edit-bar${dirty ? ' is-dirty' : ''}`} role="status">
      <p className="duty-edit-bar-status">
        {saving ? '儲存中…' : dirty ? '有未儲存的變更' : '編輯模式'}
        {hint ? <span className="duty-edit-bar-hint">{hint}</span> : null}
      </p>
      <div className="duty-edit-bar-actions">
        <button
          type="button"
          className="duty-edit-btn ghost"
          disabled={saving || !dirty}
          onClick={onDiscard}
        >
          捨棄
        </button>
        <button
          type="button"
          className="duty-edit-btn primary"
          disabled={saving || !dirty}
          onClick={onSave}
        >
          儲存
        </button>
      </div>
    </div>
  )
}

export function DutyConfirmDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: DialogState
  onClose: () => void
  onConfirm?: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel || !focusable?.length) return
      const list = [...focusable]
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocus.current?.focus?.()
    }
  }, [onClose])

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="duty-dialog-title"
        aria-describedby="duty-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="duty-dialog-title">{dialog.title}</h3>
        <p id="duty-dialog-desc" className="admin-dialog-message">
          {dialog.message}
        </p>
        {dialog.kind === 'confirm' && dialog.items && dialog.items.length > 0 ? (
          <ul className="admin-dialog-list">
            {dialog.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="admin-dialog-actions">
          {dialog.kind === 'confirm' ? (
            <>
              <button type="button" className="admin-dialog-btn ghost" onClick={onClose}>
                取消
              </button>
              <button type="button" className="admin-dialog-btn primary" onClick={onConfirm}>
                確認
              </button>
            </>
          ) : (
            <button type="button" className="admin-dialog-btn primary" onClick={onClose}>
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TeacherCodeSelect({
  value,
  onChange,
  options,
  allowEmpty,
  id,
  ariaLabel,
}: {
  value: string
  onChange: (code: string) => void
  options: { code: string; name: string }[]
  allowEmpty?: boolean
  id?: string
  ariaLabel?: string
}) {
  return (
    <select
      id={id}
      className="duty-teacher-select"
      aria-label={ariaLabel ?? '選擇教師'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">—</option> : null}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}（{o.code}）
        </option>
      ))}
    </select>
  )
}

export function teacherSelectOptions(
  nameMap: Map<string, string>,
  extraCodes: string[] = [],
): { code: string; name: string }[] {
  const codes = new Set<string>()
  for (const code of nameMap.keys()) codes.add(code)
  for (const code of extraCodes) {
    if (code) codes.add(code)
  }
  return [...codes]
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((code) => ({ code, name: nameMap.get(code) ?? code }))
}
