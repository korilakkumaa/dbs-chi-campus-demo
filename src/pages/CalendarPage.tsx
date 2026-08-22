import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { CalendarDayStatusPanel } from '../components/calendar/CalendarDayStatusPanel'
import { DayTimetablePanel, type LessonPick } from '../components/calendar/DayTimetablePanel'
import { QuickEventInput } from '../components/calendar/QuickEventInput'
import {
  EVENT_KIND_META,
  eventInMonth,
  expandIsoDateRange,
  formatEventDateLabel,
  isoDateLocal,
} from '../data/calendarEvents'
import { resolveTimetableTeacherId, listTeachersWithTimetables } from '../data/teacherTimetable'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import type { CalendarEvent, CalendarEventKind } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const LEGEND_KINDS: CalendarEventKind[] = [
  'holiday',
  'non-school-day',
  'school-day',
  'timetable',
  'event',
  'progress',
  'department',
  'assessment',
]

function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null
  }
  return date
}

function shiftIso(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return isoDateLocal(date)
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

function isoRangeInclusive(a: string, b: string): string[] {
  if (a <= b) return expandIsoDateRange(a, b)
  return expandIsoDateRange(b, a)
}

function EventMark({ kind }: { kind: CalendarEventKind }) {
  const meta = EVENT_KIND_META[kind]
  if (meta.mode === 'text') {
    return (
      <span className="detail-cal-mark text" style={{ color: meta.color }}>
        ●
      </span>
    )
  }
  if (meta.mode === 'circle') {
    return (
      <span
        className="detail-cal-mark circle"
        style={{ borderColor: meta.color, color: meta.color }}
        aria-hidden
      >
        ○
      </span>
    )
  }
  return (
    <span
      className="detail-cal-mark dot"
      style={{ background: meta.color }}
      aria-hidden
    />
  )
}

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
  } = useCampus()

  const isAdmin = user?.role === 'admin'

  const teachersWithTimetable = useMemo(() => listTeachersWithTimetables(), [])
  const defaultTeacherId =
    resolveTimetableTeacherId(user?.id, user?.role) ??
    teachersWithTimetable[0]?.teacherId ??
    null
  const [timetableTeacherId, setTimetableTeacherId] = useState<string | null>(
    defaultTeacherId,
  )
  const timetableTeacherName = useMemo(() => {
    if (!timetableTeacherId) return '教師'
    const match = teachersWithTimetable.find(
      (t) => t.teacherId === timetableTeacherId,
    )
    return match ? `${match.name}老師` : '教師'
  }, [teachersWithTimetable, timetableTeacherId])

  const todayIso = isoDateLocal()
  const paramDate = parseIsoDate(searchParams.get('date'))
  const initial = paramDate ?? new Date()

  const [year, setYear] = useState(initial.getFullYear())
  const [monthIndex, setMonthIndex] = useState(initial.getMonth())
  const [selectedIso, setSelectedIso] = useState(
    paramDate ? isoDateLocal(paramDate) : todayIso,
  )
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null)
  const [dragAnchor, setDragAnchor] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragMovedRef = useRef(false)
  const dragAdditiveRef = useRef(false)
  const [pinned, setPinned] = useState(() => Boolean(paramDate))
  const [hoverIso, setHoverIso] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const quickInputRef = useRef<HTMLInputElement>(null)
  const sideEditRef = useRef<HTMLInputElement>(null)
  const hoveringDayRef = useRef(false)
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned

  useEffect(() => {
    const next = parseIsoDate(searchParams.get('date'))
    if (!next) return
    setYear(next.getFullYear())
    setMonthIndex(next.getMonth())
    setSelectedIso(isoDateLocal(next))
    setPinned(true)
  }, [searchParams])

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const prevDays = new Date(year, monthIndex, 0).getDate()
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7
    const list: { day: number; inMonth: boolean; iso: string }[] = []
    for (let i = 0; i < total; i++) {
      if (i < startPad) {
        const day = prevDays - startPad + i + 1
        list.push({
          day,
          inMonth: false,
          iso: isoDateLocal(new Date(year, monthIndex - 1, day)),
        })
      } else if (i < startPad + daysInMonth) {
        const day = i - startPad + 1
        list.push({
          day,
          inMonth: true,
          iso: isoDateLocal(new Date(year, monthIndex, day)),
        })
      } else {
        const day = i - startPad - daysInMonth + 1
        list.push({
          day,
          inMonth: false,
          iso: isoDateLocal(new Date(year, monthIndex + 1, day)),
        })
      }
    }
    return list
  }, [year, monthIndex])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of calendarEvents) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [calendarEvents])

  const selectedEvents = useMemo(() => {
    const timeKey = (e: CalendarEvent) => {
      const start = e.lesson?.start?.trim()
      if (!start) return null
      const [h, m] = start.split(':').map(Number)
      if (Number.isNaN(h) || Number.isNaN(m)) return null
      return h * 60 + m
    }
    return (byDate.get(selectedIso) ?? []).slice().sort((a, b) => {
      const ta = timeKey(a)
      const tb = timeKey(b)
      if (ta == null && tb == null) {
        return (
          a.title.localeCompare(b.title, 'zh-Hant') || a.id.localeCompare(b.id)
        )
      }
      if (ta == null) return -1
      if (tb == null) return 1
      if (ta !== tb) return ta - tb
      return (
        (a.lesson?.end ?? '').localeCompare(b.lesson?.end ?? '') ||
        a.title.localeCompare(b.title, 'zh-Hant') ||
        a.id.localeCompare(b.id)
      )
    })
  }, [byDate, selectedIso])

  const monthEventCount = useMemo(
    () => calendarEvents.filter((e) => eventInMonth(e, year, monthIndex)).length,
    [calendarEvents, year, monthIndex],
  )

  useEffect(() => {
    if (!editingId) return
    window.requestAnimationFrame(() => {
      const el = sideEditRef.current
      if (!el) return
      el.focus()
      el.select()
    })
  }, [editingId])

  const previewDay = (iso: string) => {
    if (isAdmin && (isDragging || selectedDates.size > 1)) return
    if (pinnedRef.current) return
    if (iso === selectedIso) return
    setSelectedIso(iso)
    setEditingId(null)
  }

  const syncPrimaryFromSelection = (dates: Set<string>, fallback: string) => {
    const primary =
      dates.size > 0
        ? Array.from(dates).sort().at(-1) ?? fallback
        : fallback
    setSelectedIso(primary)
    setEditingId(null)
    const d = parseIsoDate(primary)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    return primary
  }

  const applyAdminSelection = (
    dates: Set<string>,
    anchor: string,
    opts?: { additive?: boolean },
  ) => {
    if (opts?.additive) {
      setSelectedDates((prev) => {
        const next = new Set(prev)
        for (const iso of dates) {
          if (next.has(iso)) next.delete(iso)
          else next.add(iso)
        }
        syncPrimaryFromSelection(next, anchor)
        return next
      })
    } else {
      setSelectedDates(dates)
      syncPrimaryFromSelection(dates, anchor)
    }
    setSelectionAnchor(anchor)
  }

  const onAdminDayMouseDown = (
    iso: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!isAdmin || e.button !== 0) return
    e.preventDefault()
    dragMovedRef.current = false
    dragAdditiveRef.current = e.metaKey || e.ctrlKey
    setIsDragging(true)
    setDragAnchor(iso)

    if (e.shiftKey && selectionAnchor) {
      applyAdminSelection(new Set(isoRangeInclusive(selectionAnchor, iso)), iso)
      return
    }
    if (dragAdditiveRef.current) return
    applyAdminSelection(new Set([iso]), iso)
  }

  const onAdminDayMouseEnter = (iso: string) => {
    if (!isAdmin || !isDragging || !dragAnchor) return
    dragMovedRef.current = true
    applyAdminSelection(
      new Set(isoRangeInclusive(dragAnchor, iso)),
      iso,
    )
  }

  const onAdminDayMouseUp = (iso: string) => {
    if (!isAdmin || !isDragging) return
    setIsDragging(false)
    setDragAnchor(null)
    if (!dragMovedRef.current && dragAdditiveRef.current) {
      applyAdminSelection(new Set([iso]), iso, { additive: true })
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const endDrag = () => {
      setIsDragging(false)
      setDragAnchor(null)
    }
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [isAdmin])

  const lockDay = (iso: string) => {
    if (isAdmin) {
      if (dragMovedRef.current) {
        dragMovedRef.current = false
        return
      }
      if (selectedDates.size > 1) {
        syncPrimaryFromSelection(selectedDates, iso)
      } else {
        applyAdminSelection(new Set([iso]), iso)
      }
      setPinned(true)
      setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
      return
    }
    if (pinned && selectedIso === iso) {
      setPinned(false)
      if (hoverIso && hoverIso !== iso) setSelectedIso(hoverIso)
      return
    }
    setPinned(true)
    setSelectedIso(iso)
    setEditingId(null)
    const d = parseIsoDate(iso)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
  }

  const selectDay = (iso: string) => {
    setPinned(true)
    setSelectedIso(iso)
    setEditingId(null)
    const d = parseIsoDate(iso)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingId || isTypingTarget(e.target)) return

      if (e.key === 'Escape' && pinned) {
        e.preventDefault()
        setPinned(false)
        if (hoverIso) setSelectedIso(hoverIso)
        return
      }

      if (e.key === ' ' || e.key === 'Spacebar') {
        if (!hoveringDayRef.current) return
        e.preventDefault()
        quickInputRef.current?.focus()
        quickInputRef.current?.select()
        return
      }

      let delta = 0
      if (e.key === 'ArrowLeft') delta = -1
      else if (e.key === 'ArrowRight') delta = 1
      else if (e.key === 'ArrowUp') delta = -7
      else if (e.key === 'ArrowDown') delta = 7
      else return

      e.preventDefault()
      const nextIso = shiftIso(selectedIso, delta)
      setSelectedIso(nextIso)
      setEditingId(null)
      const d = parseIsoDate(nextIso)
      if (d) {
        setYear(d.getFullYear())
        setMonthIndex(d.getMonth())
      }
      if (pinned) {
        setSearchParams(
          nextIso === todayIso ? {} : { date: nextIso },
          { replace: true },
        )
      }
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>('.detail-cal-day.selected')
          ?.focus({ preventScroll: true })
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingId, hoverIso, pinned, selectedIso, setSearchParams, todayIso])

  const goPrev = () => {
    if (monthIndex === 0) {
      setYear(year - 1)
      setMonthIndex(11)
    } else setMonthIndex(monthIndex - 1)
  }

  const goNext = () => {
    if (monthIndex === 11) {
      setYear(year + 1)
      setMonthIndex(0)
    } else setMonthIndex(monthIndex + 1)
  }

  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonthIndex(now.getMonth())
    selectDay(isoDateLocal(now))
  }

  const startEdit = (event: { id: string; title: string }) => {
    setEditingId(event.id)
    setDraft(event.title)
  }

  const commitEdit = () => {
    if (!editingId) return
    updateCalendarEvent(editingId, { title: draft.trim() })
    setEditingId(null)
  }

  const onLessonClick = (lesson: LessonPick) => {
    const iso = selectedIso
    if (!pinned) {
      setPinned(true)
      setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
    }
    const id = addCalendarEvent({
      date: iso,
      title: '',
      kind: 'progress',
      lesson: {
        group: lesson.group,
        subject: lesson.subject,
        start: lesson.start,
        end: lesson.end,
        room: lesson.room,
      },
    })
    if (!id) return
    setEditingId(id)
    setDraft('')
  }

  return (
    <div className="page calendar-page">
      <header className="page-header reveal-up">
        <div>
          <h1>詳細日曆</h1>
          <p>
            {isAdmin
              ? '拖選或 Ctrl／⌘ 多選日期，於左側標記假期與上課日；點擊時段可在右側新增事件。'
              : '點擊或拖選左側時段會在右側新增事件並跳到輸入欄；拖選相連課節會顯示連堂時間。'}
          </p>
        </div>
      </header>

      <div
        className={`detail-cal-layout${isAdmin ? ' has-admin-panel' : ''} reveal-up delay-1`}
      >
        {isAdmin && (
          <GlassPanel className="detail-cal-admin">
            <CalendarDayStatusPanel
              selectedDates={selectedDates}
              onClearSelection={() => {
                setSelectedDates(new Set())
                setSelectionAnchor(null)
              }}
            />
          </GlassPanel>
        )}

        <GlassPanel className="detail-cal-timetable">
          {teachersWithTimetable.length > 1 && (
            <label className="detail-cal-teacher-pick">
              <span>時間表</span>
              <select
                className="detail-cal-teacher-select"
                value={timetableTeacherId ?? ''}
                onChange={(e) =>
                  setTimetableTeacherId(e.target.value || null)
                }
              >
                {teachersWithTimetable.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.name}（{t.initial}）
                  </option>
                ))}
              </select>
            </label>
          )}
          <DayTimetablePanel
            iso={selectedIso}
            teacherId={timetableTeacherId}
            teacherName={timetableTeacherName}
            events={calendarEvents}
            locked={pinned}
            onLessonClick={onLessonClick}
          />
        </GlassPanel>

        <GlassPanel className="detail-cal-main">
          <div className="detail-cal-toolbar">
            <div className="detail-cal-nav">
              <button
                type="button"
                className="detail-cal-nav-btn"
                aria-label="上一個月"
                onClick={goPrev}
              >
                ‹
              </button>
              <h2 className="detail-cal-month">
                {year}年{monthIndex + 1}月
              </h2>
              <button
                type="button"
                className="detail-cal-nav-btn"
                aria-label="下一個月"
                onClick={goNext}
              >
                ›
              </button>
            </div>
            <div className="detail-cal-toolbar-meta">
              <span className="detail-cal-count">{monthEventCount} 項事件</span>
              <button
                type="button"
                className="detail-cal-today-btn"
                onClick={goToday}
              >
                今天
              </button>
            </div>
          </div>

          <div
            className="detail-cal-grid"
            role="grid"
            aria-label={`${year}年${monthIndex + 1}月，可用方向鍵瀏覽日期`}
            tabIndex={0}
          >
            {WEEKDAYS.map((w) => (
              <div key={w} className="detail-cal-weekday" role="columnheader">
                {w}
              </div>
            ))}
            {cells.map((cell) => {
              const dayEvents = byDate.get(cell.iso) ?? []
              const hasHoliday = dayEvents.some((e) => e.kind === 'holiday')
              const hasNonSchoolDay =
                !hasHoliday &&
                dayEvents.some((e) => e.kind === 'non-school-day')
              const hasTimetable = dayEvents.some((e) => e.kind === 'timetable')
              const isToday = cell.iso === todayIso
              const isSelected = cell.iso === selectedIso
              const isMultiSelected =
                isAdmin && selectedDates.has(cell.iso) && selectedDates.size > 1
              const isInSelection = isAdmin && selectedDates.has(cell.iso)
              const isHovering = hoverIso === cell.iso
              const numClass = [
                'detail-cal-day-num',
                hasHoliday && cell.inMonth ? 'holiday' : '',
                hasNonSchoolDay && cell.inMonth ? 'non-school-day' : '',
                hasTimetable && cell.inMonth ? 'timetable' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={cell.iso + String(cell.inMonth)}
                  type="button"
                  role="gridcell"
                  className={[
                    'detail-cal-day',
                    cell.inMonth ? '' : 'out',
                    hasHoliday && cell.inMonth ? 'holiday' : '',
                    hasNonSchoolDay && cell.inMonth ? 'non-school-day' : '',
                    isToday ? 'today' : '',
                    isSelected ? 'selected' : '',
                    isInSelection ? 'in-selection' : '',
                    isMultiSelected ? 'multi-selected' : '',
                    pinned && isSelected && !isAdmin ? 'locked' : '',
                    pinned && isHovering && !isSelected ? 'hovering' : '',
                    isDragging ? 'dragging' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-selected={isSelected || isInSelection}
                  aria-pressed={pinned && isSelected && !isAdmin}
                  onMouseDown={(e) => onAdminDayMouseDown(cell.iso, e)}
                  onMouseEnter={() => {
                    hoveringDayRef.current = true
                    setHoverIso(cell.iso)
                    onAdminDayMouseEnter(cell.iso)
                    previewDay(cell.iso)
                  }}
                  onMouseUp={() => onAdminDayMouseUp(cell.iso)}
                  onMouseLeave={() => {
                    hoveringDayRef.current = false
                    setHoverIso(null)
                  }}
                  onFocus={() => previewDay(cell.iso)}
                  onClick={() => lockDay(cell.iso)}
                >
                  <span className={numClass}>{cell.day}</span>
                  {cell.inMonth && dayEvents.length > 0 && (
                    <ul className="detail-cal-day-events">
                      {dayEvents.slice(0, 3).map((event) => (
                        <li
                          key={event.id}
                          className={`detail-cal-chip${event.kind === 'holiday' ? ' holiday' : ''}`}
                        >
                          <EventMark kind={event.kind} />
                          <span className="detail-cal-chip-title">
                            {event.title.trim() ||
                              (event.lesson
                                ? event.lesson.subject
                                : '（無標題）')}
                          </span>
                        </li>
                      ))}
                      {dayEvents.length > 3 && (
                        <li className="detail-cal-more">
                          +{dayEvents.length - 3}
                        </li>
                      )}
                    </ul>
                  )}
                </button>
              )
            })}
          </div>

          <ul className="detail-cal-legend">
            {LEGEND_KINDS.map((kind) => {
              const meta = EVENT_KIND_META[kind]
              return (
                <li key={kind}>
                  <EventMark kind={kind} />
                  <span>{meta.label}</span>
                </li>
              )
            })}
          </ul>
        </GlassPanel>

        <GlassPanel className="detail-cal-side">
          <div className="detail-cal-side-head">
            <p className="detail-cal-side-label">
              {formatEventDateLabel(selectedIso)}
            </p>
            {pinned && (
              <span
                className="detail-cal-side-pinned"
                title="再點該日或按 Esc 解除鎖定"
              >
                已鎖定
              </span>
            )}
          </div>
          {selectedEvents.length === 0 ? (
            <p className="detail-cal-side-empty">這一天尚無事件</p>
          ) : (
            <ul className="detail-cal-side-list" aria-label="當日事件">
              {selectedEvents.map((event) => {
                const meta = EVENT_KIND_META[event.kind]
                const editing = event.id === editingId
                const displayTitle = event.title.trim()
                return (
                  <li
                    key={event.id}
                    className={`detail-cal-side-row${event.kind === 'holiday' ? ' holiday' : ''}${event.lesson ? ' has-lesson' : ''}`}
                  >
                    <span className="detail-cal-side-kind">
                      <EventMark kind={event.kind} />
                      <span>{meta.label}</span>
                    </span>
                    {event.lesson && (
                      <div className="detail-cal-side-tags">
                        {event.lesson.group ? (
                          <span className="detail-cal-side-tag group">
                            {event.lesson.group}
                          </span>
                        ) : null}
                        {event.lesson.subject ? (
                          <span className="detail-cal-side-tag subject">
                            {event.lesson.subject}
                          </span>
                        ) : null}
                        <span className="detail-cal-side-tag time">
                          {event.lesson.start}–{event.lesson.end}
                        </span>
                      </div>
                    )}
                    {editing ? (
                      <input
                        ref={sideEditRef}
                        className="detail-cal-side-edit"
                        value={draft}
                        autoFocus
                        placeholder=""
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
                      />
                    ) : (
                      <button
                        type="button"
                        className={`detail-cal-side-title${displayTitle ? '' : ' empty'}`}
                        onClick={() => startEdit(event)}
                        onDoubleClick={() => startEdit(event)}
                      >
                        {displayTitle || '\u00a0'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="detail-cal-side-delete"
                      aria-label={`刪除事件`}
                      onClick={() => deleteCalendarEvent(event.id)}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <QuickEventInput
            date={selectedIso}
            inputRef={quickInputRef}
            onAdd={({ title, date, kind }) => {
              addCalendarEvent({ title, date, kind })
              selectDay(date)
            }}
          />
        </GlassPanel>
      </div>
    </div>
  )
}
