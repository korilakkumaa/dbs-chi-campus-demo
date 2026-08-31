import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { CalendarDayStatusPanel } from '../components/calendar/CalendarDayStatusPanel'
import { DayTimetablePanel, type LessonPick } from '../components/calendar/DayTimetablePanel'
import { CalendarSubscribePanel } from '../components/calendar/CalendarSubscribePanel'
import { QuickEventInput } from '../components/calendar/QuickEventInput'
import { resolveEventTime } from '../data/calendarIcs'
import {
  EVENT_KIND_META,
  eventInMonth,
  expandIsoDateRange,
  formatEventDateLabel,
  isoDateLocal,
  isColourOnlyDayStatus,
  dayStatusCustomNote,
} from '../data/calendarEvents'
import {
  canMutateCalendarEvent,
  defaultCalendarAudience,
} from '../data/calendarStore'
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

type EventClipboard = {
  title: string
  kind: CalendarEventKind
  audience: CalendarEvent['audience']
  lesson?: CalendarEvent['lesson']
}

function clipboardItemLabel(clip: EventClipboard): string {
  const title = clip.title.trim()
  if (title) return title
  if (clip.lesson?.subject) return clip.lesson.subject
  return EVENT_KIND_META[clip.kind].label
}

function clipboardLabel(items: EventClipboard[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return clipboardItemLabel(items[0])
  return `${clipboardItemLabel(items[0])} 等 ${items.length} 項`
}

function eventToClipboard(event: CalendarEvent): EventClipboard {
  return {
    title: event.title,
    kind: event.kind,
    audience: event.audience,
    ...(event.lesson ? { lesson: event.lesson } : {}),
  }
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
    addCalendarEvents,
    updateCalendarEvent,
    deleteCalendarEvent,
    deleteCalendarEvents,
  } = useCampus()

  const isAdmin = user?.role === 'admin'

  const teachersWithTimetable = useMemo(() => listTeachersWithTimetables(), [])
  const ownTeacherId = resolveTimetableTeacherId(user?.id, user?.role)
  const [adminTimetableTeacherId, setAdminTimetableTeacherId] = useState<
    string | null
  >(() => teachersWithTimetable[0]?.teacherId ?? null)
  const timetableTeacherId = isAdmin ? adminTimetableTeacherId : ownTeacherId
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
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [clipboard, setClipboard] = useState<EventClipboard[] | null>(null)
  const [lastPasteIds, setLastPasteIds] = useState<string[]>([])
  const [pasteNotice, setPasteNotice] = useState<string | null>(null)
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
      const slot = resolveEventTime(e)
      if (!slot) return null
      const [h, m] = slot.start.split(':').map(Number)
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
      const endA = resolveEventTime(a)?.end ?? ''
      const endB = resolveEventTime(b)?.end ?? ''
      return (
        endA.localeCompare(endB) ||
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

  useEffect(() => {
    if (!pasteNotice) return
    const timer = window.setTimeout(() => setPasteNotice(null), 2400)
    return () => window.clearTimeout(timer)
  }, [pasteNotice])

  const copySelectedEvents = () => {
    if (!user || (user.role !== 'admin' && user.role !== 'teacher')) return false
    const sources = [...selectedEventIds]
      .map(
        (id) =>
          calendarEvents.find((ev) => ev.id === id) ??
          selectedEvents.find((ev) => ev.id === id),
      )
      .filter((ev): ev is CalendarEvent => Boolean(ev))
    if (sources.length === 0) return false
    setClipboard(sources.map(eventToClipboard))
    setPasteNotice(`已複製 ${sources.length} 項 — 點選日期後按 ⌘V／Ctrl+V 貼上`)
    return true
  }

  const pasteClipboardToDate = (iso: string) => {
    if (!clipboard?.length || !user) return false
    const inputs = clipboard.map((item) => {
      const audience =
        user.role === 'admin'
          ? item.audience
          : defaultCalendarAudience(user, item.lesson)
      return {
        date: iso,
        title: item.title,
        kind: item.kind,
        audience,
        lesson: item.lesson,
      }
    })
    const createdIds = addCalendarEvents(inputs)
    if (createdIds.length === 0) return false
    setLastPasteIds(createdIds)
    setSelectedEventIds(new Set(createdIds))
    setEditingId(null)
    setPasteNotice(
      `已貼上 ${createdIds.length} 項至 ${formatEventDateLabel(iso)}（⌘Z 可復原）`,
    )
    return true
  }

  const undoLastPaste = () => {
    if (lastPasteIds.length === 0) return false
    const removed = deleteCalendarEvents(lastPasteIds)
    setLastPasteIds([])
    setSelectedEventIds(new Set())
    setEditingId(null)
    if (removed === 0) return false
    setPasteNotice(`已復原貼上（${removed} 項）`)
    return true
  }

  const removeSelectedEvents = () => {
    if (selectedEventIds.size === 0) return false
    const removed = deleteCalendarEvents([...selectedEventIds])
    if (removed === 0) return false
    setSelectedEventIds(new Set())
    setEditingId(null)
    return true
  }

  const focusDay = (iso: string, clearEvent = true) => {
    setPinned(true)
    setSelectedIso(iso)
    setEditingId(null)
    if (clearEvent) setSelectedEventIds(new Set())
    const d = parseIsoDate(iso)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
  }

  const onEventChipClick = (
    event: CalendarEvent,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const additive = e.metaKey || e.ctrlKey
    if (event.date !== selectedIso) {
      focusDay(event.date, !additive)
    }
    setSelectedEventIds((prev) => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(event.id)) next.delete(event.id)
        else next.add(event.id)
        return next
      }
      return new Set([event.id])
    })
    setPasteNotice(null)
  }

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
    if (isAdmin && dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    if (isAdmin) {
      if (selectedDates.size > 1) {
        syncPrimaryFromSelection(selectedDates, iso)
      } else {
        applyAdminSelection(new Set([iso]), iso)
      }
      setPinned(true)
      setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
      setSelectedEventIds(new Set())
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
    setSelectedEventIds(new Set())
    const d = parseIsoDate(iso)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    setSearchParams(iso === todayIso ? {} : { date: iso }, { replace: true })
  }

  const selectDay = (iso: string) => {
    focusDay(iso, true)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingId || isTypingTarget(e.target)) return

      if (e.key === 'Escape') {
        if (clipboard || selectedEventIds.size > 0) {
          e.preventDefault()
          setClipboard(null)
          setSelectedEventIds(new Set())
          setPasteNotice(null)
          return
        }
        if (pinned) {
          e.preventDefault()
          setPinned(false)
          if (hoverIso) setSelectedIso(hoverIso)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (undoLastPaste()) {
          e.preventDefault()
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (copySelectedEvents()) {
          e.preventDefault()
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (clipboard?.length) {
          e.preventDefault()
          if (pasteClipboardToDate(selectedIso)) {
            focusDay(selectedIso, false)
          }
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEventIds.size === 0) return
        e.preventDefault()
        removeSelectedEvents()
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
      setSelectedEventIds(new Set())
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
  }, [
    addCalendarEvents,
    calendarEvents,
    clipboard,
    deleteCalendarEvents,
    editingId,
    hoverIso,
    lastPasteIds,
    pinned,
    selectedEventIds,
    selectedEvents,
    selectedIso,
    setSearchParams,
    todayIso,
    user,
  ])

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

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id)
    setDraft(event.title)
    const slot = resolveEventTime(event)
    setDraftStart(slot?.start ?? '')
    setDraftEnd(slot?.end ?? '')
  }

  const commitEdit = () => {
    if (!editingId) return
    const current = calendarEvents.find((e) => e.id === editingId)
    const title = draft.trim()
    const patch: Partial<Pick<CalendarEvent, 'title' | 'time' | 'lesson'>> = {
      title,
    }
    if (draftStart && draftEnd && draftStart < draftEnd) {
      if (current?.lesson) {
        patch.lesson = {
          ...current.lesson,
          start: draftStart,
          end: draftEnd,
        }
      } else {
        patch.time = { start: draftStart, end: draftEnd }
      }
    } else if (!current?.lesson) {
      patch.time = undefined
    }
    updateCalendarEvent(editingId, patch)
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
              ? '拖選或 Ctrl／⌘ 多選日期，於左側標記假期與上課日。點擊活動選取，⌘／Ctrl+點擊可多選；⌘C 複製、點日期後 ⌘V 貼上、⌘Z 復原貼上；Delete 刪除。'
              : '點擊活動選取，⌘／Ctrl+點擊可多選；⌘C 複製、點日期後 ⌘V 貼上、⌘Z 復原貼上；Delete 刪除自己的活動。點擊或拖選左側時段可新增事件。'}
          </p>
        </div>
        <CalendarSubscribePanel calendarEvents={calendarEvents} />
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
          {isAdmin && teachersWithTimetable.length > 1 && (
            <label className="detail-cal-teacher-pick">
              <span>時間表</span>
              <select
                className="detail-cal-teacher-select"
                value={timetableTeacherId ?? ''}
                onChange={(e) =>
                  setAdminTimetableTeacherId(e.target.value || null)
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
              {clipboard && clipboard.length > 0 && (
                <span className="detail-cal-paste-hint" role="status">
                  已複製「{clipboardLabel(clipboard)}」— 點選日期後按 ⌘V／Ctrl+V
                </span>
              )}
              {selectedEventIds.size > 0 && !clipboard?.length && (
                <span className="detail-cal-paste-hint" role="status">
                  已選 {selectedEventIds.size} 項 — 按 ⌘C／Ctrl+C 複製
                </span>
              )}
              {pasteNotice && (
                <span className="detail-cal-paste-notice" role="status">
                  {pasteNotice}
                </span>
              )}
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
              const chipEvents = dayEvents.filter(
                (event) => !isColourOnlyDayStatus(event),
              )
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
                  {cell.inMonth && chipEvents.length > 0 && (
                    <ul className="detail-cal-day-events">
                      {chipEvents.slice(0, 3).map((event) => {
                        const chipSelected = selectedEventIds.has(event.id)
                        const label =
                          event.title.trim() ||
                          (event.lesson
                            ? event.lesson.subject
                            : '（無標題）')
                        return (
                          <li
                            key={event.id}
                            className={[
                              'detail-cal-chip',
                              event.kind === 'holiday' ? 'holiday' : '',
                              'selectable',
                              chipSelected ? 'selected' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            title={`${label}（點選；⌘／Ctrl+點擊多選）`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => onEventChipClick(event, e)}
                          >
                            <EventMark kind={event.kind} />
                            <span className="detail-cal-chip-title">
                              {label}
                            </span>
                          </li>
                        )
                      })}
                      {chipEvents.length > 3 && (
                        <li className="detail-cal-more">
                          +{chipEvents.length - 3}
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
          {(() => {
            const sideEvents = selectedEvents.filter(
              (event) => isAdmin || !isColourOnlyDayStatus(event),
            )
            if (sideEvents.length === 0) {
              return <p className="detail-cal-side-empty">這一天尚無事件</p>
            }
            return (
            <ul className="detail-cal-side-list" aria-label="當日事件">
              {sideEvents.map((event) => {
                const meta = EVENT_KIND_META[event.kind]
                const editing = event.id === editingId
                const slot = resolveEventTime(event)
                const colourOnly = isColourOnlyDayStatus(event)
                const customNote = dayStatusCustomNote(event)
                const displayTitle = colourOnly
                  ? '（僅顏色標記）'
                  : customNote ||
                    event.title.trim() ||
                    event.lesson?.subject ||
                    ''
                const mutable = canMutateCalendarEvent(user, event)
                const rowSelected = selectedEventIds.has(event.id)
                return (
                  <li
                    key={event.id}
                    className={[
                      'detail-cal-side-row',
                      event.kind === 'holiday' ? 'holiday' : '',
                      event.kind === 'non-school-day' ? 'non-school-day' : '',
                      event.lesson ? 'has-lesson' : '',
                      colourOnly ? 'colour-only' : 'selectable',
                      rowSelected ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={(e) => {
                      const additive = e.metaKey || e.ctrlKey
                      setSelectedEventIds((prev) => {
                        if (additive) {
                          const next = new Set(prev)
                          if (next.has(event.id)) next.delete(event.id)
                          else next.add(event.id)
                          return next
                        }
                        return new Set([event.id])
                      })
                      setPasteNotice(null)
                    }}
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
                      </div>
                    )}
                    {slot && (
                      <span className="detail-cal-side-tag time standalone">
                        {slot.start}–{slot.end}
                      </span>
                    )}
                    {editing ? (
                      <>
                      <input
                        ref={sideEditRef}
                        className="detail-cal-side-edit"
                        value={draft}
                        autoFocus
                        placeholder="說明（可留空）"
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
                      <div className="detail-cal-side-time-edit">
                        <input
                          type="time"
                          value={draftStart}
                          aria-label="開始時間"
                          onChange={(e) => setDraftStart(e.target.value)}
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={draftEnd}
                          aria-label="結束時間"
                          onChange={(e) => setDraftEnd(e.target.value)}
                        />
                      </div>
                      </>
                    ) : mutable ? (
                      <button
                        type="button"
                        className={`detail-cal-side-title${displayTitle && !colourOnly ? '' : ' empty'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(event)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          startEdit(event)
                        }}
                      >
                        {displayTitle || '\u00a0'}
                      </button>
                    ) : (
                      <span
                        className={`detail-cal-side-title${displayTitle && !colourOnly ? '' : ' empty'}`}
                      >
                        {displayTitle || '\u00a0'}
                      </span>
                    )}
                    {mutable && (
                    <button
                      type="button"
                      className="detail-cal-side-delete"
                      aria-label={`刪除事件`}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCalendarEvent(event.id)
                        setSelectedEventIds((prev) => {
                          if (!prev.has(event.id)) return prev
                          const next = new Set(prev)
                          next.delete(event.id)
                          return next
                        })
                      }}
                    >
                      ×
                    </button>
                    )}
                  </li>
                )
              })}
            </ul>
            )
          })()}

          <QuickEventInput
            date={selectedIso}
            inputRef={quickInputRef}
            onAdd={({ title, date, kind, time }) => {
              addCalendarEvent({ title, date, kind, time })
              selectDay(date)
            }}
          />
        </GlassPanel>
      </div>
    </div>
  )
}
