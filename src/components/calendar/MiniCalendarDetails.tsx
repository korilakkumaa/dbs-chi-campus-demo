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
  compareEventsUpcomingFirst,
  eventBoundaryMs,
  eventInMonth,
  eventMatchesHomeTodoFilter,
  eventMentionsGrades,
  formatCompactMonthDates,
  formatEventDateLabel,
  isCalendarStatusKind,
  type HomeTodoKindFilter,
} from '../../data/calendarEvents'
import { resolveEventTime } from '../../data/calendarIcs'
import { canMutateCalendarEvent } from '../../data/calendarStore'
import type { CalendarEvent, CalendarEventKind, User } from '../../types'

type Props = {
  year: number
  monthIndex: number
  events: CalendarEvent[]
  user?: User | null
  /** When set,「任教相關」filters to these form grades. */
  teachingGrades?: number[]
  onUpdateTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
}

/** How far ahead「即將到來」looks, independent of the open calendar month. */
const UPCOMING_HORIZON_MS = 60 * 24 * 60 * 60 * 1000
const UPCOMING_LIMIT = 18
/** Recent past window when user expands「顯示已過」. */
const PAST_LOOKBACK_MS = 21 * 24 * 60 * 60 * 1000
const PAST_LIMIT = 12

const KIND_FILTERS: { id: HomeTodoKindFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'personal', label: '個人' },
  { id: 'event', label: '校曆' },
  { id: 'progress', label: '進度' },
  { id: 'department', label: '科組' },
  { id: 'assessment', label: '測考' },
]

function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

function eventWhenLabel(event: CalendarEvent): string {
  const date = formatEventDateLabel(event.date)
  const slot = resolveEventTime(event)
  return slot ? `${date} ${slot.start}` : date
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
  teachingGrades = [],
  onUpdateTitle,
  onDelete,
}: Props) {
  const nowMs = useMinuteNow()
  const [showPast, setShowPast] = useState(false)
  /** Opt-in: default off so the list isn’t empty on first load. */
  const [relevantOnly, setRelevantOnly] = useState(false)
  const [kindFilter, setKindFilter] = useState<HomeTodoKindFilter>('all')

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

  const actionableEvents = useMemo(() => {
    return events
      .filter((e) => !isCalendarStatusKind(e.kind))
      .filter((e) => eventMatchesHomeTodoFilter(e, kindFilter, user?.id))
      .filter((e) =>
        relevantOnly ? eventMentionsGrades(e, teachingGrades) : true,
      )
  }, [events, kindFilter, user?.id, relevantOnly, teachingGrades])

  const upcomingEvents = useMemo(() => {
    const horizonEnd = nowMs + UPCOMING_HORIZON_MS
    return actionableEvents
      .filter((e) => {
        const end = eventBoundaryMs(e, 'end')
        const start = eventBoundaryMs(e, 'start')
        return end >= nowMs && start <= horizonEnd
      })
      .slice()
      .sort((a, b) => compareEventsUpcomingFirst(a, b, nowMs))
      .slice(0, UPCOMING_LIMIT)
  }, [actionableEvents, nowMs])

  const pastEvents = useMemo(() => {
    const lookbackStart = nowMs - PAST_LOOKBACK_MS
    return actionableEvents
      .filter((e) => {
        const end = eventBoundaryMs(e, 'end')
        return end < nowMs && end >= lookbackStart
      })
      .slice()
      .sort((a, b) => compareEventsUpcomingFirst(a, b, nowMs))
      .slice(0, PAST_LIMIT)
  }, [actionableEvents, nowMs])

  const listEvents = useMemo(
    () => (showPast ? [...upcomingEvents, ...pastEvents] : upcomingEvents),
    [showPast, upcomingEvents, pastEvents],
  )

  const nextEventId = upcomingEvents[0]?.id ?? null
  const pastCount = pastEvents.length

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

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = 0
  }, [nextEventId, showPast, kindFilter, relevantOnly])

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

  const hasStatus = statusSummaries.length > 0
  const hasActionable = actionableEvents.length > 0

  return (
    <div className="cal-detail">
      <div className="cal-detail-head">
        <p className="cal-detail-label">即將到來</p>
        <p className="cal-detail-month">近 60 日</p>
      </div>

      {hasStatus && (
        <ul className="cal-detail-status-strip" aria-label="本月上課日狀態">
          {statusSummaries.map((row) => (
            <li
              key={row.kind}
              className="cal-detail-status-chip"
              title={`${row.label}：${row.datesText}`}
            >
              <EventMark kind={row.kind} />
              <span className="cal-detail-status-label">{row.label}</span>
              <span className="cal-detail-status-count">{row.count}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="cal-detail-filters" role="toolbar" aria-label="待辦篩選">
        {teachingGrades.length > 0 && (
          <button
            type="button"
            className={`cal-detail-filter${relevantOnly ? ' active' : ''}`}
            aria-pressed={relevantOnly}
            onClick={() => setRelevantOnly((v) => !v)}
          >
            任教相關
          </button>
        )}
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`cal-detail-filter${kindFilter === f.id ? ' active' : ''}`}
            aria-pressed={kindFilter === f.id}
            onClick={() => setKindFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!hasActionable ? (
        <p className="cal-detail-empty">尚無符合條件的事件</p>
      ) : listEvents.length === 0 ? (
        <p className="cal-detail-empty">
          近 60 日沒有即將到來的事件
          {pastCount > 0 ? `（可顯示近期已過 ${pastCount} 項）` : ''}
        </p>
      ) : (
        <ul
          ref={listRef}
          className="cal-detail-list"
          tabIndex={0}
          role="listbox"
          aria-label="即將到來的活動與待辦"
          onKeyDown={onListKeyDown}
        >
          {listEvents.map((event) => {
            const meta = EVENT_KIND_META[event.kind]
            const selected = event.id === selectedId
            const editing = event.id === editingId
            const mutable = canMutateCalendarEvent(user, event)
            const isNext = event.id === nextEventId
            const isPast = eventBoundaryMs(event, 'end') < nowMs
            return (
              <li
                key={event.id}
                role="option"
                aria-selected={selected}
                className={[
                  'cal-detail-row',
                  selected ? 'selected' : '',
                  isNext ? 'next' : '',
                  isPast ? 'past' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(event.id)}
              >
                <span className="cal-detail-when">
                  <EventMark kind={event.kind} />
                  <span className="cal-detail-date">{eventWhenLabel(event)}</span>
                  {isNext && <span className="cal-detail-next-tag">接下來</span>}
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
      )}

      {pastCount > 0 && (
        <button
          type="button"
          className="cal-detail-past-toggle"
          aria-pressed={showPast}
          onClick={() => setShowPast((v) => !v)}
        >
          {showPast ? '隱藏已過事件' : `顯示近期已過 ${pastCount} 項`}
        </button>
      )}
    </div>
  )
}
