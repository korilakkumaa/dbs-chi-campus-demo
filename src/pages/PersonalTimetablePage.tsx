import { useMemo, useState, type CSSProperties } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import {
  formatAcademicYearLabel,
  academicYearStartFromIso,
} from '../data/academicYear'
import {
  formatEventDateLabel,
  isoDateLocal,
  mondayOfWeekIso,
  schoolWeekDates,
  shiftIsoDays,
} from '../data/calendarEvents'
import {
  teacherTimetableEntry,
  getDayTimetable,
  getTeacherPeriodsOnDate,
  isTeacherFreeAtDate,
  lessonHighlight,
  listTeachersWithTimetables,
  resolveTimetableTeacherId,
  weekdayLabel,
  type DayPeriod,
  type DayTimetableResult,
} from '../data/teacherTimetable'

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

export function PersonalTimetablePage() {
  const { user } = useAuth()
  const { calendarEvents } = useCampus()
  const teachers = useMemo(() => listTeachersWithTimetables(), [])
  const ownTeacherId = resolveTimetableTeacherId(user?.id, user?.role)

  const [weekMonday, setWeekMonday] = useState(() =>
    mondayOfWeekIso(isoDateLocal()),
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (ownTeacherId) return new Set([ownTeacherId])
    const first = teachers[0]?.teacherId
    return first ? new Set([first]) : new Set()
  })

  const selectedList = useMemo(
    () => Array.from(selectedIds),
    [selectedIds],
  )

  const weekDates = useMemo(
    () => schoolWeekDates(weekMonday),
    [weekMonday],
  )

  const primaryTeacherId = selectedList[0] ?? null
  const primaryEntry = useMemo(() => {
    if (!primaryTeacherId) return null
    return teacherTimetableEntry(
      primaryTeacherId,
      academicYearStartFromIso(weekMonday),
    )
  }, [primaryTeacherId, weekMonday])

  const weekColumns: WeekDayColumn[] = useMemo(() => {
    const refId = primaryTeacherId ?? teachers[0]?.teacherId ?? null
    return weekDates.map((iso) => ({
      iso,
      result: getDayTimetable(refId, iso, calendarEvents),
    }))
  }, [weekDates, primaryTeacherId, teachers, calendarEvents])

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
    setSelectedIds((prev) => {
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
    })
  }

  if (teachers.length === 0) {
    return (
      <div className="page">
        <header className="page-header reveal-up">
          <h1>個人時間表</h1>
          <p>任教堂次與個人時間表。</p>
        </header>
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">尚未匯入時間表。</p>
        </GlassPanel>
      </div>
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

  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>個人時間表</h1>
        <p>
          {yearLabel} 學年 · {formatWeekRange(weekMonday)}
          {selectedList.length === 1 && lessonCount != null && (
            <> · 本週 {lessonCount} 節</>
          )}
          {selectedList.length > 1 && (
            <>
              {' '}
              · 已選 {selectedList.length} 位 · 共同空堂 {commonFreeCount}{' '}
              節
            </>
          )}
        </p>
      </header>

      <GlassPanel className="personal-tt reveal-up delay-1">
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
              onClick={() =>
                setWeekMonday(mondayOfWeekIso(isoDateLocal()))
              }
            >
              本週
            </button>
          )}
        </div>

        <div className="personal-tt-layout">
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
                const active = selectedIds.has(t.teacherId)
                return (
                  <button
                    key={t.teacherId}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`personal-tt-teacher${active ? ' active' : ''}`}
                    title={`${t.name}（${t.initial}）`}
                    onClick={(e) =>
                      onTeacherClick(
                        t.teacherId,
                        e.metaKey || e.ctrlKey,
                      )
                    }
                  >
                    {t.initial}
                  </button>
                )
              })}
            </div>
            <p className="personal-tt-teachers-hint">⌘／Ctrl 多選以檢視共同空堂</p>
          </aside>

          <div className="personal-tt-wrap">
            {!primaryEntry ? (
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
                      return (
                        <th key={col.iso} scope="col">
                          <span className="personal-tt-date">
                            {formatEventDateLabel(col.iso)}
                          </span>
                          {note && (
                            <span
                              className={`personal-tt-day-note${
                                col.result.status === 'ok' ? ' adopt' : ' off'
                              }`}
                            >
                              {note}
                            </span>
                          )}
                        </th>
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
                            <span className="personal-tt-time-end">
                              {row.end}
                            </span>
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
                          <span className="personal-tt-time-end">
                            {row.end}
                          </span>
                        </th>
                        {weekColumns.map((col) => {
                          if (col.result.status !== 'ok') {
                            return (
                              <td
                                key={col.iso}
                                className="personal-tt-td off-day"
                              >
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
                                ? lessonHighlight(
                                    period.group,
                                    period.subject,
                                  )
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
      </GlassPanel>
    </div>
  )
}
