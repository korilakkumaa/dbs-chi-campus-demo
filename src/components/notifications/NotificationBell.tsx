import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../context/NotificationsContext'
import type { SystemNotification } from '../../data/systemNotifications'

const PANEL_MARGIN = 12
const PANEL_GAP = 8
const PANEL_MAX_WIDTH = 352

function formatCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

function calendarLinkFor(n: SystemNotification): string {
  const dates = n.payload.dates
  const date =
    Array.isArray(dates) && typeof dates[0] === 'string'
      ? dates[0]
      : undefined
  return date ? `/calendar?date=${encodeURIComponent(date)}` : '/calendar'
}

type PanelPos = { top: number; left: number; width: number; maxHeight: number }

function computePanelPos(anchor: DOMRect): PanelPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(PANEL_MAX_WIDTH, Math.max(200, vw - PANEL_MARGIN * 2))
  let left = anchor.right - width
  if (left < PANEL_MARGIN) left = PANEL_MARGIN
  if (left + width > vw - PANEL_MARGIN) {
    left = Math.max(PANEL_MARGIN, vw - PANEL_MARGIN - width)
  }

  const spaceBelow = vh - anchor.bottom - PANEL_GAP - PANEL_MARGIN
  const spaceAbove = anchor.top - PANEL_GAP - PANEL_MARGIN
  const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
  const maxHeight = Math.min(
    384,
    Math.max(120, preferBelow ? spaceBelow : spaceAbove),
  )
  const top = preferBelow
    ? anchor.bottom + PANEL_GAP
    : Math.max(PANEL_MARGIN, anchor.top - PANEL_GAP - maxHeight)

  return { top, left, width, maxHeight }
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const reposition = () => {
    const btn = btnRef.current
    if (!btn) return
    setPanelPos(computePanelPos(btn.getBoundingClientRect()))
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    reposition()
  }, [open, notifications.length, unreadCount])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReposition = () => reposition()
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className={`notif-bell-btn${open ? ' open' : ''}${
          unreadCount > 0 ? ' has-unread' : ''
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `系統通知，${unreadCount} 則未讀`
            : '系統通知'
        }
        title="系統通知"
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          if (btnRef.current) {
            setPanelPos(
              computePanelPos(btnRef.current.getBoundingClientRect()),
            )
          }
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="notif-bell-icon">
          <path
            fill="currentColor"
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="notif-bell-count" aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open && panelPos ? (
        <div
          ref={panelRef}
          className="notif-panel glass"
          role="dialog"
          aria-label="系統通知"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxHeight,
          }}
        >
          <div className="notif-panel-head">
            <h2 className="notif-panel-title">系統通知</h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="notif-panel-action"
                onClick={() => markAllRead()}
              >
                全部已讀
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="notif-empty">暫無通知</p>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`notif-item${n.readAt ? '' : ' unread'}`}
                >
                  <Link
                    to={calendarLinkFor(n)}
                    className="notif-item-link"
                    onClick={() => {
                      if (!n.readAt) markRead(n.id)
                      setOpen(false)
                    }}
                  >
                    <span className="notif-item-title">{n.title}</span>
                    {n.body ? (
                      <span className="notif-item-body">{n.body}</span>
                    ) : null}
                    <span className="notif-item-meta">
                      新日曆事件 · {formatCreatedAt(n.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
