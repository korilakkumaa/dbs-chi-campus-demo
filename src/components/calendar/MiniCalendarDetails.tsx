import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  CALENDAR_STATUS_KINDS,
  EVENT_KIND_META,
  eventInMonth,
  formatCompactMonthDates,
  formatEventDateLabel,
  isCalendarStatusKind,
} from '../../data/calendarEvents'
import { canMutateCalendarEvent } from '../../data/calendarStore'
import type { CalendarEvent, CalendarEventKind, User } from '../../types'

type Props = {
  year: number
  monthIndex: number
  events: CalendarEvent[]
  user?: User | null
  onUpdateTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function EventMark({ kind }: { kind: CalendarEventKind }) {
  const meta = EVENT_KIND_META[kind]
  if (meta.mode === 'text') {
    return (
      <span className="cal-detail-mark text" style={{ color: meta.color }}>
        ●
      </span>
    )
  }
  if (meta.mode === 'circle') {
    return (
      <span
        className="cal-detail-mark circle"
        style={{ borderColor: meta.color, color: meta.color }}
        aria-hidden
      >
        ○
      </span>
    )
  }
  return (
    <span
      className="cal-detail-mark dot"
      style={{ background: meta.color }}
    />
  )
}

export function MiniCalendarDetails({
  year,
  monthIndex,
  events,
  user,
  onUpdateTitle,
  onDelete,
}: Props) {
  const monthEvents = useMemo(
    () =>
      events
        .filter((e) => eventInMonth(e, year, monthIndex))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.title.localeCompare(b.title, 'zh-Hant'),
        ),
    [events, year, monthIndex],
  )

  const statusSummaries = useMemo(() => {
    return CALENDAR_STATUS_KINDS.map((kind) => {
      const dates = monthEvents
        .filter((e) => e.kind === kind)
        .map((e) => e.date)
      if (dates.length === 0) return null
      return {
        kind,
        label: EVENT_KIND_META[kind].label,
        datesText: formatCompactMonthDates(dates),
        count: new Set(dates).size,
      }
    }).filter((row): row is NonNullable<typeof row> => row != null)
  }, [monthEvents])

  const listEvents = useMemo(
    () => monthEvents.filter((e) => !isCalendarStatusKind(e.kind)),
    [monthEvents],
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (selectedId && !listEvents.some((e) => e.id === selectedId)) {
      setSelectedId(listEvents[0]?.id ?? null)
    }
  }, [listEvents, selectedId])

  const startEdit = (event: CalendarEvent) => {
    if (!canMutateCalendarEvent(user, event)) return
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
    if (listEvents.length === 0) return
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

    const idx = listEvents.findIndex((ev) => ev.id === selectedId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next =
        listEvents[Math.min(listEvents.length - 1, Math.max(0, idx) + 1)]
      setSelectedId(next.id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = listEvents[Math.max(0, (idx < 0 ? 0 : idx) - 1)]
      setSelectedId(prev.id)
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      const target =
        listEvents.find((ev) => ev.id === selectedId) ?? listEvents[0]
      if (target) startEdit(target)
    }
  }

  const hasContent = statusSummaries.length > 0 || listEvents.length > 0

  return (
    <div className="cal-detail">
      <p className="cal-detail-label">
        {year}年{monthIndex + 1}月概覽
      </p>

      {!hasContent ? (
        <p className="cal-detail-empty">本月尚無事件</p>
      ) : (
        <>
          {statusSummaries.length > 0 && (
            <ul className="cal-detail-summary" aria-label="本月上課日狀態">
              {statusSummaries.map((row) => (
                <li key={row.kind} className="cal-detail-summary-row">
                  <span className="cal-detail-summary-kind">
                    <EventMark kind={row.kind} />
                    <span>{row.label}</span>
                  </span>
                  <span className="cal-detail-summary-meta">
                    {row.count} 日
                  </span>
                  <span className="cal-detail-summary-dates">{row.datesText}</span>
                </li>
              ))}
            </ul>
          )}

          {listEvents.length > 0 && (
            <>
              {statusSummaries.length > 0 && (
                <p className="cal-detail-sublabel">活動與待辦</p>
              )}
              <ul
                ref={listRef}
                className="cal-detail-list"
                tabIndex={0}
                role="listbox"
                aria-label="本月活動與待辦"
                onKeyDown={onListKeyDown}
              >
                {listEvents.map((event) => {
                  const meta = EVENT_KIND_META[event.kind]
                  const selected = event.id === selectedId
                  const editing = event.id === editingId
                  const mutable = canMutateCalendarEvent(user, event)
                  return (
                    <li
                      key={event.id}
                      role="option"
                      aria-selected={selected}
                      className={`cal-detail-row${selected ? ' selected' : ''}`}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <span className="cal-detail-when">
                        <EventMark kind={event.kind} />
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
                      ) : mutable ? (
                        <button
                          type="button"
                          className={`cal-detail-title${event.title.trim() ? '' : ' empty'}`}
                          onDoubleClick={() => startEdit(event)}
                        >
                          {event.title.trim() ||
                            (event.lesson
                              ? `${event.lesson.group} · ${event.lesson.subject}`
                              : meta.label)}
                        </button>
                      ) : (
                        <span
                          className={`cal-detail-title${event.title.trim() ? '' : ' empty'}`}
                        >
                          {event.title.trim() ||
                            (event.lesson
                              ? `${event.lesson.group} · ${event.lesson.subject}`
                              : meta.label)}
                        </span>
                      )}
                      {mutable && (
                      <button
                        type="button"
                        className="cal-detail-delete"
                        aria-label="刪除事件"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(event.id)
                        }}
                      >
                        ×
                      </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
