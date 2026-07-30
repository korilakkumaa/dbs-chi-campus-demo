import { useEffect } from 'react'
import { TOOL_SHORTCUTS } from '../data/toolShortcuts'

export function ToolsSidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={`tools-backdrop${open ? ' open' : ''}`}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside
        id="tools-sidebar"
        className={`tools-sidebar glass${open ? ' open' : ''}`}
        aria-hidden={!open}
        aria-label="常用連結"
      >
        <div className="tools-sidebar-head">
          <h2>常用連結</h2>
          <button
            type="button"
            className="tools-close"
            onClick={onClose}
            aria-label="關閉常用連結"
          >
            ×
          </button>
        </div>
        <ul className="tools-list">
          {TOOL_SHORTCUTS.map((tool) => (
            <li key={tool.id}>
              <a
                className="tools-link"
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={open ? 0 : -1}
              >
                <span className="tools-link-label">{tool.label}</span>
                {tool.blurb ? (
                  <span className="tools-link-blurb">{tool.blurb}</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
