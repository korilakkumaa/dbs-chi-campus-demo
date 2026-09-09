import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { CalendarDayDetail } from '../components/calendar/CalendarDayDetail'
import { CalendarDayStatusPanel } from '../components/calendar/CalendarDayStatusPanel'
import { CalendarMonthGrid } from '../components/calendar/CalendarMonthGrid'
import { CalendarSubscribePanel } from '../components/calendar/CalendarSubscribePanel'
import {
  eventToClipboard,
  type EventClipboard,
} from '../components/calendar/calendarClipboard'
import {
  isoRangeInclusive,
  parseIsoDate,
} from '../components/calendar/calendarDateUtils'
import { useCalendarKeyboard } from '../components/calendar/useCalendarKeyboard'
import { DayTimetablePanel, type LessonPick } from '../components/calendar/DayTimetablePanel'
import { resolveEventTime } from '../data/calendarIcs'
import {
  eventInMonth,
  formatEventDateLabel,
  isoDateLocal,
} from '../data/calendarEvents'
import { defaultCalendarAudience } from '../data/calendarStore'
import { resolveTimetableTeacherId, listTeachersWithTimetables } from '../data/teacherTimetable'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import type { CalendarEvent } from '../types'

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

  useCalendarKeyboard({
    editingId,
    clipboard,
    selectedEventIds,
    selectedIso,
    pinned,
    hoverIso,
    todayIso,
    hoveringDayRef,
    quickInputRef,
    setClipboard,
    setSelectedEventIds,
    setPasteNotice,
    setPinned,
    setSelectedIso,
    setEditingId,
    setYear,
    setMonthIndex,
    setSearchParams,
    copySelectedEvents,
    pasteClipboardToDate,
    undoLastPaste,
    removeSelectedEvents,
    focusDay,
  })

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
      <header className="page-header calendar-page-header reveal-up">
        <div className="calendar-page-header-text">
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
          <CalendarMonthGrid
            year={year}
            monthIndex={monthIndex}
            monthEventCount={monthEventCount}
            cells={cells}
            byDate={byDate}
            todayIso={todayIso}
            selectedIso={selectedIso}
            selectedDates={selectedDates}
            selectedEventIds={selectedEventIds}
            hoverIso={hoverIso}
            pinned={pinned}
            isAdmin={isAdmin}
            isDragging={isDragging}
            clipboard={clipboard}
            pasteNotice={pasteNotice}
            hoveringDayRef={hoveringDayRef}
            onGoPrev={goPrev}
            onGoNext={goNext}
            onGoToday={goToday}
            onAdminDayMouseDown={onAdminDayMouseDown}
            onAdminDayMouseEnter={onAdminDayMouseEnter}
            onAdminDayMouseUp={onAdminDayMouseUp}
            onPreviewDay={previewDay}
            onLockDay={lockDay}
            onEventChipClick={onEventChipClick}
            setHoverIso={setHoverIso}
          />
        </GlassPanel>

        <GlassPanel className="detail-cal-side">
          <CalendarDayDetail
            selectedIso={selectedIso}
            pinned={pinned}
            isAdmin={isAdmin}
            selectedEvents={selectedEvents}
            selectedEventIds={selectedEventIds}
            editingId={editingId}
            draft={draft}
            draftStart={draftStart}
            draftEnd={draftEnd}
            sideEditRef={sideEditRef}
            quickInputRef={quickInputRef}
            user={user}
            onSelectEventIds={setSelectedEventIds}
            onClearPasteNotice={() => setPasteNotice(null)}
            onDraftChange={setDraft}
            onDraftStartChange={setDraftStart}
            onDraftEndChange={setDraftEnd}
            onCommitEdit={commitEdit}
            onCancelEdit={() => setEditingId(null)}
            onStartEdit={startEdit}
            onDeleteEvent={(id) => {
              deleteCalendarEvent(id)
              setSelectedEventIds((prev) => {
                if (!prev.has(id)) return prev
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            }}
            onAddQuickEvent={({ title, date, kind, time }) => {
              addCalendarEvent({ title, date, kind, time })
              selectDay(date)
            }}
          />
        </GlassPanel>
      </div>
    </div>
  )
}
