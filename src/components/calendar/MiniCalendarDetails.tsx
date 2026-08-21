import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  EVENT_KIND_META,
  eventInMonth,
  formatEventDateLabel,
} from '../../data/calendarEvents'
import type { CalendarEvent } from '../../types'

type Props = {
  year: number
  monthIndex: number
  events: CalendarEvent[]
  onUpdateTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function MiniCalendarDetails({
  year,
  monthIndex,
  events,
  onUpdateTitle,
  onDelete,
}: Props) {
  const monthEvents = events
    .filter((e) => eventInMonth(e, year, monthIndex))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'zh-Hant'))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (
      selectedId &&
      !monthEvents.some((e) => e.id === selectedId)
    ) {
      setSelectedId(monthEvents[0]?.id ?? null)
    }
  }, [monthEvents, selectedId])

  const startEdit = (event: CalendarEvent) => {
    setSelectedId(event.id)
    setEditingId(event.id)
    setDraft(event.title)
  }

  const commitEdit = () => {
    if (!editingId) return
    onUpdateTitle(editingId, draft.trim())
    setEditingId(null)
  }

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (monthEvents.length === 0) return
    if (editingId) {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditingId(null)
      }
      return
    }

    const idx = monthEvents.findIndex((ev) => ev.id === selectedId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = monthEvents[Math.min(monthEvents.length - 1, Math.max(0, idx) + 1)]
      setSelectedId(next.id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = monthEvents[Math.max(0, (idx < 0 ? 0 : idx) - 1)]
      setSelectedId(prev.id)
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      const target = monthEvents.find((ev) => ev.id === selectedId) ?? monthEvents[0]
      if (target) startEdit(target)
    }
  }

  return (
    <div className="cal-detail">
      <p className="cal-detail-label">
        {year}年{monthIndex + 1}月事件
      </p>
      {monthEvents.length === 0 ? (
        <p className="cal-detail-empty">本月尚無事件</p>
      ) : (
        <ul
          ref={listRef}
          className="cal-detail-list"
          tabIndex={0}
          role="listbox"
          aria-label="本月事件"
          onKeyDown={onListKeyDown}
        >
          {monthEvents.map((event) => {
            const meta = EVENT_KIND_META[event.kind]
            const selected = event.id === selectedId
            const editing = event.id === editingId
            return (
              <li
                key={event.id}
                role="option"
                aria-selected={selected}
                className={`cal-detail-row${selected ? ' selected' : ''}`}
                onClick={() => setSelectedId(event.id)}
              >
                <span className="cal-detail-when">
                  {meta.mode === 'text' ? (
                    <span
                      className="cal-detail-mark text"
                      style={{ color: meta.color }}
                    >
                      ●
                    </span>
                  ) : meta.mode === 'circle' ? (
                    <span
                      className="cal-detail-mark circle"
                      style={{ borderColor: meta.color, color: meta.color }}
                      aria-hidden
                    >
                      ○
                    </span>
                  ) : (
                    <span
                      className="cal-detail-mark dot"
                      style={{ background: meta.color }}
                    />
                  )}
                  <span className="cal-detail-date">
                    {formatEventDateLabel(event.date)}
                  </span>
                </span>
                {editing ? (
                  <input
                    ref={inputRef}
                    className="cal-detail-edit"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                        e.preventDefault()
                        e.stopPropagation()
                        commitEdit()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditingId(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    className={`cal-detail-title${event.title.trim() ? '' : ' empty'}`}
                    onDoubleClick={() => startEdit(event)}
                  >
                    {event.title.trim() ||
                      (event.lesson
                        ? `${event.lesson.group} · ${event.lesson.subject}`
                        : '（無標題）')}
                  </button>
                )}
                <button
                  type="button"
                  className="cal-detail-delete"
                  aria-label={`刪除事件`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(event.id)
                  }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
