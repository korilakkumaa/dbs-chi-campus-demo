import type { DialogState } from './adminHelpers'

export function AdminDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: DialogState
  onClose: () => void
  onConfirm?: () => void
}) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        aria-describedby="admin-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="admin-dialog-title">{dialog.title}</h3>
        <p id="admin-dialog-desc" className="admin-dialog-message">
          {dialog.message}
        </p>
        {dialog.kind === 'confirm' && dialog.items.length > 0 && (
          <ul className="admin-dialog-list">
            {dialog.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="admin-dialog-actions">
          {dialog.kind === 'confirm' ? (
            <>
              <button
                type="button"
                className="admin-dialog-btn ghost"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                className="admin-dialog-btn primary"
                onClick={onConfirm}
              >
                確認遞交
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-dialog-btn primary"
              onClick={onClose}
            >
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function SubmitTick({
  id,
  checked,
  disabled,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <div className="deadline-check deadline-submit-check">
      <input
        id={id}
        type="checkbox"
        className="task-checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="checkbox-label" htmlFor={id}>
        <span className="checkbox-box" aria-hidden>
          <span className="checkbox-fill" />
          <span className="success-ripple" />
          <span className="checkmark">
            <svg className="check-icon" viewBox="0 0 24 24">
              <path d="M9.00001 16.17L4.83001 12L3.41001 13.41L9.00001 19L21 7.00001L19.59 5.59001L9.00001 16.17Z" />
            </svg>
          </span>
        </span>
        <span className="sr-only">{label}</span>
      </label>
    </div>
  )
}
