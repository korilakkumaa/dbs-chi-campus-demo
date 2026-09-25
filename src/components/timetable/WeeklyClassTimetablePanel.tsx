import { useMemo, useRef, useState } from 'react'
import { useCampus } from '../../context/CampusContext'
import {
  formatAcademicYearLabel,
  academicYearStartFromIso,
  academicYearDateRange,
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
  classTimetableEntry,
  countClassWeekLessons,
  getClassDayTimetable,
  getClassPeriodsOnDate,
  listClassesWithTimetables,
  listClassTimetableAcademicYearStarts,
  listClassTimetableGradeLabels,
} from '../../data/classTimetable'
import {
  defaultTimetableWeekMonday,
  timetableViewStartYear,
  weekdayLabel,
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
  return EVENT_KIND_META[event.kind].label
}

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.slice().sort((a, b) => {
    return (
      a.title.localeCompare(b.title, 'zh-Hant') || a.id.localeCompare(b.id)
    )
  })
}

function schoolWideEvent(event: CalendarEvent): boolean {
  const a = event.audience
  return a.type === 'all' || a.type === 'grades'
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
        aria-describedby={hasEvents ? `school-tt-preview-${iso}` : undefined}
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
            id={`school-tt-preview-${iso}`}
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

/** Split streamed "A · B" cells into stacked lines for readability. */
function SlotCell({ period }: { period: DayPeriod | undefined }) {
  if (!period || period.type === 'break') {
    return <span className="personal-tt-cell-mute">—</span>
  }
  if (period.type === 'free') {
    return <span className="personal-tt-cell-free">空堂</span>
  }

  const subjects = period.subject.split(/\s*·\s*/).map((s) => s.trim())
  const teachers = period.group.split(/\s*·\s*/).map((s) => s.trim())
  const rooms = period.room.split(/\s*·\s*/).map((s) => s.trim())
  const count = Math.max(subjects.length, teachers.length, rooms.length, 1)

  if (count <= 1) {
    return (
      <div className="personal-tt-cell-lesson">
        <span className="personal-tt-cell-group">{period.subject}</span>
        <span className="personal-tt-cell-meta">
          {[period.group, period.room].filter(Boolean).join(' · ')}
        </span>
      </div>
    )
  }

  return (
    <ul className="personal-tt-cell-stack school-tt-stream-stack">
      {Array.from({ length: count }, (_, i) => {
        const subject = subjects[i] ?? subjects[0] ?? ''
        const teacher = teachers[i] ?? ''
        const room = rooms[i] ?? ''
        return (
          <li key={`${subject}-${i}`} className="personal-tt-stack-item">
            <span className="personal-tt-stack-lesson">
              <strong>{subject}</strong>
              {(teacher || room) && (
                <span className="personal-tt-cell-meta">
                  {[teacher, room].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

type WeekDayColumn = {
  iso: string
  result: DayTimetableResult
}

export function WeeklyClassTimetablePanel({
  embedded = false,
}: {
  embedded?: boolean
}) {
  const { calendarEvents } = useCampus()

  const [weekMonday, setWeekMonday] = useState(() => defaultTimetableWeekMonday())
  const jumpDateRef = useRef<HTMLInputElement>(null)

  const jumpRange = useMemo(() => {
    const years = listClassTimetableAcademicYearStarts()
    if (years.length === 0) {
      return { min: undefined as string | undefined, max: undefined as string | undefined }
    }
    return {
      min: academicYearDateRange(Math.min(...years)).from,
      max: academicYearDateRange(Math.max(...years)).to,
    }
  }, [])

  const jumpToIso = (iso: string) => {
    if (!iso) return
    setWeekMonday(mondayOfWeekIso(iso))
  }

  const viewStartYear = useMemo(
    () => timetableViewStartYear(weekMonday),
    [weekMonday],
  )

  const classes = useMemo(
    () => listClassesWithTimetables(viewStartYear),
    [viewStartYear],
  )

  const gradeLabels = useMemo(
    () => listClassTimetableGradeLabels(viewStartYear),
    [viewStartYear],
  )

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [gradeFilter, setGradeFilter] = useState<string | null>(null)

  const effectiveGrade = useMemo(() => {
    if (gradeFilter && gradeLabels.includes(gradeFilter)) return gradeFilter
    return gradeLabels[0] ?? null
  }, [gradeFilter, gradeLabels])

  const classesInGrade = useMemo(() => {
    if (!effectiveGrade) return classes
    return classes.filter((c) => c.gradeLabel === effectiveGrade)
  }, [classes, effectiveGrade])

  const effectiveClassKey = useMemo(() => {
    if (selectedKey && classes.some((c) => c.classKey === selectedKey)) {
      return selectedKey
    }
    return classesInGrade[0]?.classKey ?? classes[0]?.classKey ?? null
  }, [selectedKey, classes, classesInGrade])

  const selectedMeta = useMemo(
    () => classes.find((c) => c.classKey === effectiveClassKey) ?? null,
    [classes, effectiveClassKey],
  )

  const weekDates = useMemo(() => schoolWeekDates(weekMonday), [weekMonday])

  const entry = useMemo(() => {
    if (!effectiveClassKey) return null
    return classTimetableEntry(effectiveClassKey, viewStartYear)
  }, [effectiveClassKey, viewStartYear])

  const weekColumns: WeekDayColumn[] = useMemo(() => {
    return weekDates.map((iso) => ({
      iso,
      result: getClassDayTimetable(effectiveClassKey, iso, calendarEvents),
    }))
  }, [weekDates, effectiveClassKey, calendarEvents])

  const dayEventsByIso = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of calendarEvents) {
      if (!schoolWideEvent(event)) continue
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    for (const [iso, list] of map) {
      map.set(iso, sortDayEvents(list))
    }
    return map
  }, [calendarEvents])

  const rows = useMemo(() => {
    if (!entry) return []
    const okDay = weekColumns.find((c) => c.result.status === 'ok')
    const sample =
      okDay && okDay.result.status === 'ok'
        ? okDay.result.periods
        : entry.weekly[1]
    return buildRows(sample)
  }, [entry, weekColumns])

  const lessonCount = useMemo(() => {
    if (!effectiveClassKey) return null
    return countClassWeekLessons(effectiveClassKey, weekDates, calendarEvents)
  }, [effectiveClassKey, weekDates, calendarEvents])

  const isCurrentWeek = weekMonday === mondayOfWeekIso(isoDateLocal())

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

  if (classes.length === 0) {
    return <p className="empty-note">尚未匯入全校時間表。</p>
  }

  const summaryParts: string[] = [
    `${yearLabel} 學年 · ${formatWeekRange(weekMonday)}`,
  ]
  if (selectedMeta) {
    summaryParts.push(selectedMeta.displayLabel)
    if (selectedMeta.homeRoom) summaryParts.push(`課室 ${selectedMeta.homeRoom}`)
    if (selectedMeta.classTeacher) {
      summaryParts.push(`班主任 ${selectedMeta.classTeacher}`)
    }
  }
  if (lessonCount != null) {
    summaryParts.push(`本週 ${lessonCount} 節`)
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
        <label
          className="personal-tt-week-btn personal-tt-jump"
          onClick={() => jumpDateRef.current?.showPicker?.()}
        >
          跳至日期
          <input
            ref={jumpDateRef}
            type="date"
            className="personal-tt-jump-native"
            value={weekMonday}
            min={jumpRange.min}
            max={jumpRange.max}
            aria-label="選擇日期，跳至該週時間表"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => jumpToIso(e.target.value)}
          />
        </label>
      </div>

      <div className="personal-tt-layout school-tt-layout">
        <aside className="school-tt-sidebar" aria-label="選擇班別">
          <div className="school-tt-grades" role="tablist" aria-label="年級">
            {gradeLabels.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={effectiveGrade === g}
                className={`school-tt-grade${effectiveGrade === g ? ' active' : ''}`}
                onClick={() => {
                  setGradeFilter(g)
                  const first = classes.find((c) => c.gradeLabel === g)
                  if (first) setSelectedKey(first.classKey)
                }}
              >
                {g === 'CLP' ? 'CLP' : g}
              </button>
            ))}
          </div>
          <p className="personal-tt-teachers-label">班別</p>
          <div
            className="school-tt-class-list"
            role="listbox"
            aria-label="班別"
          >
            {classesInGrade.map((c) => {
              const active = effectiveClassKey === c.classKey
              return (
                <button
                  key={c.classKey}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`personal-tt-teacher school-tt-class${active ? ' active' : ''}`}
                  title={
                    [
                      c.classKey,
                      c.classTeacher ? `班主任 ${c.classTeacher}` : null,
                      c.homeRoom ? `課室 ${c.homeRoom}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  onClick={() => setSelectedKey(c.classKey)}
                >
                  {c.displayLabel}
                </button>
              )
            })}
          </div>
        </aside>

        <div className="personal-tt-wrap">
          {!entry || !effectiveClassKey ? (
            <p className="empty-note">請選擇班別。</p>
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

                        const periods = getClassPeriodsOnDate(
                          effectiveClassKey,
                          col.iso,
                          calendarEvents,
                        )
                        const period = periods
                          ? findPeriod(periods, row.start, row.end)
                          : undefined
                        const isFree = period?.type === 'free'
                        const isLesson = period?.type === 'lesson'
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
                          >
                            <SlotCell period={period} />
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
