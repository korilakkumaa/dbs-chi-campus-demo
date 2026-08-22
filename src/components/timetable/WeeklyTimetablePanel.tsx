import { useMemo, useState, type CSSProperties } from 'react'
import { useCampus } from '../../context/CampusContext'
import {
  formatAcademicYearLabel,
  academicYearStartFromIso,
} from '../../data/academicYear'
import {
  formatEventDateLabel,
  isoDateLocal,
  mondayOfWeekIso,
  schoolWeekDates,
  shiftIsoDays,
  EVENT_KIND_META,
} from '../../data/calendarEvents'
import {
  teacherTimetableEntry,
  getDayTimetable,
  getTeacherPeriodsOnDate,
  isTeacherFreeAtDate,
  lessonHighlight,
  listTeachersWithTimetables,
  weekdayLabel,
  calendarEventTargetsTeacher,
  defaultTimetableWeekMonday,
  timetableViewStartYear,
  type DayPeriod,
  type DayTimetableResult,
} from '../../data/teacherTimetable'
import type { CalendarEvent, CalendarEventKind } from '../../types'

/** Skip daily fixed bookends — same every day, just noise in a week grid. */
function isBookendBreak(p: DayPeriod): boolean {
  if (p.type !== 'break') return false
  const label = p.label ?? ''
  return label === '早會' || label === '放學'
}

type GridRow =
  | { kind: 'slot'; start: string; end: string }
  | { kind: 'break'; start: string; end: string; label: string }

function buildRows(sample: DayPeriod[]): GridRow[] {
  const rows: GridRow[] = []
  for (const p of sample) {
    if (isBookendBreak(p)) continue
    if (p.type === 'break') {
      rows.push({
        kind: 'break',
        start: p.start,
        end: p.end,
        label: p.label ?? '休息',
      })
      continue
    }
    rows.push({ kind: 'slot', start: p.start, end: p.end })
  }
  return rows
}

function findPeriod(
  periods: DayPeriod[],
  start: string,
  end: string,
): DayPeriod | undefined {
  return periods.find((p) => p.start === start && p.end === end)
}

function shortGroup(group: string): string {
  return group
    .split(/,\s*/)
    .map((g) => g.replace(/^G/, ''))
    .join(' · ')
}

function formatWeekRange(mondayIso: string): string {
  const fri = shiftIsoDays(mondayIso, 4)
  const short = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}/${Number(d)}`
  }
  if (mondayIso.slice(0, 4) !== fri.slice(0, 4)) {
    return `${formatEventDateLabel(mondayIso)} – ${formatEventDateLabel(fri)}`
  }
  return `${short(mondayIso)} – ${short(fri)}`
}

function dayHeaderNote(result: DayTimetableResult): string | null {
  switch (result.status) {
    case 'ok':
      if (result.adoptedFrom != null) {
        return `按${weekdayLabel(result.weekday)}`
      }
      return null
    case 'holiday':
      return '假期'
    case 'non-school-day':
      return '非正常上課日'
    case 'weekend':
      return '週末'
    case 'out-of-year':
      return '非本學年'
    default:
      return null
  }
}

function EventMark({ kind }: { kind: CalendarEventKind }) {
  const meta = EVENT_KIND_META[kind]
  if (meta.mode === 'text') {
    return (
      <span className="personal-tt-preview-mark text" style={{ color: meta.color }}>
        ●
      </span>
    )
  }
  if (meta.mode === 'circle') {
    return (
      <span
        className="personal-tt-preview-mark circle"
        style={{ borderColor: meta.color, color: meta.color }}
        aria-hidden
      >
        ○
      </span>
    )
  }
  return (
    <span
      className="personal-tt-preview-mark dot"
      style={{ background: meta.color }}
    />
  )
}

function eventDisplayTitle(event: CalendarEvent): string {
  const trimmed = event.title.trim()
  if (trimmed) return trimmed
  if (event.lesson) {
    const parts = [
      event.lesson.group,
      event.lesson.subject,
      event.lesson.start
        ? `${event.lesson.start}–${event.lesson.end}`
        : null,
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
  }
  return EVENT_KIND_META[event.kind].label
}

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const timeKey = (e: CalendarEvent) => {
    const start = e.lesson?.start?.trim()
    if (!start) return null
    const [h, m] = start.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  return events.slice().sort((a, b) => {
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
}

function DayDateHeader({
  iso,
  note,
  noteTone,
  events,
}: {
  iso: string
  note: string | null
  noteTone: 'adopt' | 'off' | null
  events: CalendarEvent[]
}) {
  const hasEvents = events.length > 0
  return (
    <th
      scope="col"
      className={`personal-tt-day-head${hasEvents ? ' has-events' : ''}`}
    >
      <span
        className="personal-tt-day-head-inner"
        tabIndex={hasEvents ? 0 : undefined}
        aria-describedby={hasEvents ? `personal-tt-preview-${iso}` : undefined}
      >
        <span className="personal-tt-date">{formatEventDateLabel(iso)}</span>
        {note && (
          <span
            className={`personal-tt-day-note${
              noteTone === 'adopt' ? ' adopt' : noteTone === 'off' ? ' off' : ''
            }`}
          >
            {note}
          </span>
        )}
        {hasEvents && (
          <div
            id={`personal-tt-preview-${iso}`}
            className="personal-tt-day-preview"
            role="tooltip"
          >
            <ul className="personal-tt-day-preview-list">
              {events.map((event) => (
                <li key={event.id} className="personal-tt-day-preview-row">
                  <EventMark kind={event.kind} />
                  <span className="personal-tt-day-preview-kind">
                    {EVENT_KIND_META[event.kind].label}
                  </span>
                  <span className="personal-tt-day-preview-title">
                    {eventDisplayTitle(event)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </span>
    </th>
  )
}

function SlotCell({ period }: { period: DayPeriod | undefined }) {
  if (!period || period.type === 'break') {
    return <span className="personal-tt-cell-mute">—</span>
  }
  if (period.type === 'free') {
    return <span className="personal-tt-cell-free">空堂</span>
  }
  return (
    <div className="personal-tt-cell-lesson">
      <span className="personal-tt-cell-group">{shortGroup(period.group)}</span>
      <span className="personal-tt-cell-meta">
        {period.subject}
        {period.room ? ` · ${period.room}` : ''}
      </span>
    </div>
  )
}

type StackEntry = {
  initial: string
  period: DayPeriod
}

function MultiSlotCell({
  entries,
  isCommonFree,
}: {
  entries: StackEntry[]
  isCommonFree: boolean
}) {
  if (isCommonFree) {
    return <span className="personal-tt-cell-common-free">共同空堂</span>
  }

  return (
    <ul className="personal-tt-cell-stack">
      {entries.map(({ initial, period }) => (
        <li key={initial} className="personal-tt-stack-item">
          <span className="personal-tt-stack-initial">{initial}</span>
          {period.type === 'free' ? (
            <span className="personal-tt-cell-free">空堂</span>
          ) : period.type === 'lesson' ? (
            <span className="personal-tt-stack-lesson">
              {shortGroup(period.group)} · {period.subject}
            </span>
          ) : (
            <span className="personal-tt-cell-mute">—</span>
          )}
        </li>
      ))}
    </ul>
  )
}

type WeekDayColumn = {
  iso: string
  result: DayTimetableResult
}

function countCommonFreeSlots(
  teacherIds: string[],
  weekDates: string[],
  rows: GridRow[],
  events: ReturnType<typeof useCampus>['calendarEvents'],
): number {
  if (teacherIds.length < 2) return 0
  let count = 0
  for (const iso of weekDates) {
    for (const row of rows) {
      if (row.kind !== 'slot') continue
      const allFree = teacherIds.every((id) =>
        isTeacherFreeAtDate(id, iso, row.start, row.end, events),
      )
      if (allFree) count++
    }
  }
  return count
}

function countWeekLessons(
  teacherId: string,
  weekDates: string[],
  events: ReturnType<typeof useCampus>['calendarEvents'],
): number {
  let count = 0
  for (const iso of weekDates) {
    const periods = getTeacherPeriodsOnDate(teacherId, iso, events)
    if (!periods) continue
    count += periods.filter((p) => p.type === 'lesson').length
  }
  return count
}

export type WeeklyTimetablePanelProps = {
  /** Single-teacher mode: hide picker and lock selection. */
  fixedTeacherId?: string | null
  /** Admin mode: show all teachers with ⌘／Ctrl multi-select. */
  multiSelect?: boolean
  selectedIds?: Set<string>
  onSelectedIdsChange?: (ids: Set<string>) => void
  embedded?: boolean
}

export function WeeklyTimetablePanel({
  fixedTeacherId = null,
  multiSelect = false,
  selectedIds: controlledSelectedIds,
  onSelectedIdsChange,
  embedded = false,
}: WeeklyTimetablePanelProps) {
  const { calendarEvents } = useCampus()

  const [weekMonday, setWeekMonday] = useState(() => defaultTimetableWeekMonday())

  const viewStartYear = useMemo(
    () => timetableViewStartYear(weekMonday),
    [weekMonday],
  )

  const teachers = useMemo(
    () => listTeachersWithTimetables(viewStartYear),
    [viewStartYear],
  )

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(
    () => {
      if (fixedTeacherId) return new Set([fixedTeacherId])
      const first = teachers[0]?.teacherId
      return first ? new Set([first]) : new Set()
    },
  )

  const selectedIds =
    fixedTeacherId != null
      ? new Set([fixedTeacherId])
      : (controlledSelectedIds ?? internalSelectedIds)

  const effectiveSelectedIds = useMemo(() => {
    const available = new Set(teachers.map((t) => t.teacherId))
    const filtered = new Set(
      Array.from(selectedIds).filter((id) => available.has(id)),
    )
    if (filtered.size > 0) return filtered
    const first = teachers[0]?.teacherId
    return first ? new Set([first]) : new Set<string>()
  }, [selectedIds, teachers])

  const setSelectedIds = (next: Set<string>) => {
    if (fixedTeacherId != null) return
    if (onSelectedIdsChange) onSelectedIdsChange(next)
    else setInternalSelectedIds(next)
  }

  const selectedList = useMemo(
    () => Array.from(effectiveSelectedIds),
    [effectiveSelectedIds],
  )

  const weekDates = useMemo(
    () => schoolWeekDates(weekMonday),
    [weekMonday],
  )

  const primaryTeacherId = selectedList[0] ?? null
  const primaryEntry = useMemo(() => {
    if (!primaryTeacherId) return null
    return teacherTimetableEntry(primaryTeacherId, viewStartYear)
  }, [primaryTeacherId, viewStartYear])

  const weekColumns: WeekDayColumn[] = useMemo(() => {
    const refId = primaryTeacherId ?? teachers[0]?.teacherId ?? null
    return weekDates.map((iso) => ({
      iso,
      result: getDayTimetable(refId, iso, calendarEvents),
    }))
  }, [weekDates, primaryTeacherId, teachers, calendarEvents])

  const dayEventsByIso = useMemo(() => {
    const teacherId = primaryTeacherId
    const map = new Map<string, CalendarEvent[]>()
    if (!teacherId) return map
    for (const event of calendarEvents) {
      if (!calendarEventTargetsTeacher(event, teacherId)) continue
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    for (const [iso, list] of map) {
      map.set(iso, sortDayEvents(list))
    }
    return map
  }, [calendarEvents, primaryTeacherId])

  const rows = useMemo(() => {
    if (!primaryEntry) return []
    const okDay = weekColumns.find((c) => c.result.status === 'ok')
    const sample =
      okDay && okDay.result.status === 'ok'
        ? okDay.result.periods
        : primaryEntry.weekly[1]
    return buildRows(sample)
  }, [primaryEntry, weekColumns])

  const lessonCount = useMemo(() => {
    if (!primaryTeacherId || selectedList.length !== 1) return null
    return countWeekLessons(primaryTeacherId, weekDates, calendarEvents)
  }, [primaryTeacherId, selectedList.length, weekDates, calendarEvents])

  const commonFreeCount = useMemo(
    () =>
      countCommonFreeSlots(selectedList, weekDates, rows, calendarEvents),
    [selectedList, weekDates, rows, calendarEvents],
  )

  const isCurrentWeek = weekMonday === mondayOfWeekIso(isoDateLocal())

  const onTeacherClick = (teacherId: string, additive: boolean) => {
    if (!multiSelect || fixedTeacherId != null) return
    setSelectedIds(
      (() => {
        const prev = effectiveSelectedIds
        if (additive) {
          const next = new Set(prev)
          if (next.has(teacherId)) {
            if (next.size <= 1) return prev
            next.delete(teacherId)
          } else {
            next.add(teacherId)
          }
          return next
        }
        return new Set([teacherId])
      })(),
    )
  }

  const weekYearLabel = useMemo(
    () => formatAcademicYearLabel(academicYearStartFromIso(weekMonday)),
    [weekMonday],
  )

  const weekYearEndLabel = useMemo(
    () =>
      formatAcademicYearLabel(
        academicYearStartFromIso(shiftIsoDays(weekMonday, 4)),
      ),
    [weekMonday],
  )

  const yearLabel =
    weekYearLabel === weekYearEndLabel
      ? weekYearLabel
      : `${weekYearLabel}–${weekYearEndLabel}`

  if (teachers.length === 0) {
    return <p className="empty-note">尚未匯入時間表。</p>
  }

  if (fixedTeacherId != null && !primaryEntry) {
    return <p className="empty-note">尚未匯入您的個人時間表。</p>
  }

  const summaryParts: string[] = [
    `${yearLabel} 學年 · ${formatWeekRange(weekMonday)}`,
  ]
  if (selectedList.length === 1 && lessonCount != null) {
    summaryParts.push(`本週 ${lessonCount} 節`)
  }
  if (multiSelect && selectedList.length > 1) {
    summaryParts.push(
      `已選 ${selectedList.length} 位 · 共同空堂 ${commonFreeCount} 節`,
    )
  }

  return (
    <div className={embedded ? 'personal-tt-embedded' : undefined}>
      {!embedded ? (
        <p className="personal-tt-summary">{summaryParts.join(' · ')}</p>
      ) : null}

      <div className="personal-tt-week-nav">
        <button
          type="button"
          className="personal-tt-week-btn"
          onClick={() => setWeekMonday((m) => shiftIsoDays(m, -7))}
        >
          ‹ 上週
        </button>
        <span className="personal-tt-week-label">{formatWeekRange(weekMonday)}</span>
        <button
          type="button"
          className="personal-tt-week-btn"
          onClick={() => setWeekMonday((m) => shiftIsoDays(m, 7))}
        >
          下週 ›
        </button>
        {!isCurrentWeek && (
          <button
            type="button"
            className="personal-tt-week-today"
            onClick={() => setWeekMonday(mondayOfWeekIso(isoDateLocal()))}
          >
            本週
          </button>
        )}
      </div>

      <div className="personal-tt-layout">
        {multiSelect ? (
          <aside
            className="personal-tt-teachers"
            aria-label="選擇老師（⌘／Ctrl 多選）"
          >
            <p className="personal-tt-teachers-label">老師</p>
            <div
              className="personal-tt-teacher-list"
              role="listbox"
              aria-multiselectable
            >
              {teachers.map((t) => {
                const active = effectiveSelectedIds.has(t.teacherId)
                return (
                  <button
                    key={t.teacherId}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`personal-tt-teacher${active ? ' active' : ''}`}
                    title={`${t.name}（${t.initial}）`}
                    onClick={(e) =>
                      onTeacherClick(t.teacherId, e.metaKey || e.ctrlKey)
                    }
                  >
                    {t.initial}
                  </button>
                )
              })}
            </div>
            <p className="personal-tt-teachers-hint">⌘／Ctrl 多選以檢視共同空堂</p>
          </aside>
        ) : null}

        <div className="personal-tt-wrap">
          {teachers.length === 0 ? (
            <p className="empty-note">
              {formatAcademicYearLabel(viewStartYear)} 學年尚未匯入時間表。
            </p>
          ) : !primaryEntry ? (
            <p className="empty-note">請選擇至少一位老師。</p>
          ) : (
            <table className="personal-tt-table">
              <thead>
                <tr>
                  <th scope="col" className="personal-tt-time-head">
                    時間
                  </th>
                  {weekColumns.map((col) => {
                    const note = dayHeaderNote(col.result)
                    const dayEvents = dayEventsByIso.get(col.iso) ?? []
                    return (
                      <DayDateHeader
                        key={col.iso}
                        iso={col.iso}
                        note={note}
                        noteTone={
                          col.result.status === 'ok'
                            ? 'adopt'
                            : note
                              ? 'off'
                              : null
                        }
                        events={dayEvents}
                      />
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.kind === 'break') {
                    return (
                      <tr
                        key={`break-${row.start}`}
                        className="personal-tt-break-row"
                      >
                        <th scope="row" className="personal-tt-time-cell">
                          <span className="personal-tt-time-start">
                            {row.start}
                          </span>
                          <span className="personal-tt-time-end">{row.end}</span>
                        </th>
                        <td colSpan={5} className="personal-tt-break-cell">
                          {row.label}
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={`slot-${row.start}`}>
                      <th scope="row" className="personal-tt-time-cell">
                        <span className="personal-tt-time-start">
                          {row.start}
                        </span>
                        <span className="personal-tt-time-end">{row.end}</span>
                      </th>
                      {weekColumns.map((col) => {
                        if (col.result.status !== 'ok') {
                          return (
                            <td key={col.iso} className="personal-tt-td off-day">
                              <span className="personal-tt-cell-mute">—</span>
                            </td>
                          )
                        }

                        if (selectedList.length === 1) {
                          const teacherId = selectedList[0]
                          const periods = getTeacherPeriodsOnDate(
                            teacherId,
                            col.iso,
                            calendarEvents,
                          )
                          const period = periods
                            ? findPeriod(periods, row.start, row.end)
                            : undefined
                          const isFree = period?.type === 'free'
                          const isLesson = period?.type === 'lesson'
                          const hl =
                            isLesson && period.type === 'lesson'
                              ? lessonHighlight(period.group, period.subject)
                              : null
                          return (
                            <td
                              key={col.iso}
                              className={
                                isLesson
                                  ? 'personal-tt-td lesson'
                                  : isFree
                                    ? 'personal-tt-td free'
                                    : 'personal-tt-td'
                              }
                              style={
                                hl
                                  ? ({
                                      '--tt-accent': hl.accent,
                                      '--tt-soft': hl.soft,
                                      '--tt-text': hl.text,
                                    } as CSSProperties)
                                  : undefined
                              }
                            >
                              <SlotCell period={period} />
                            </td>
                          )
                        }

                        const entries: StackEntry[] = []
                        for (const teacherId of selectedList) {
                          const meta = teachers.find(
                            (t) => t.teacherId === teacherId,
                          )
                          const periods = getTeacherPeriodsOnDate(
                            teacherId,
                            col.iso,
                            calendarEvents,
                          )
                          const period = periods
                            ? findPeriod(periods, row.start, row.end)
                            : undefined
                          if (!meta || !period || period.type === 'break') {
                            continue
                          }
                          entries.push({ initial: meta.initial, period })
                        }

                        const isCommonFree =
                          selectedList.length > 1 &&
                          selectedList.every((id) =>
                            isTeacherFreeAtDate(
                              id,
                              col.iso,
                              row.start,
                              row.end,
                              calendarEvents,
                            ),
                          )

                        return (
                          <td
                            key={col.iso}
                            className={
                              isCommonFree
                                ? 'personal-tt-td common-free'
                                : 'personal-tt-td stacked'
                            }
                          >
                            <MultiSlotCell
                              entries={entries}
                              isCommonFree={isCommonFree}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
