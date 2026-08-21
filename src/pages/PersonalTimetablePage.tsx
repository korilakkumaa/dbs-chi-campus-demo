import { useMemo, type CSSProperties } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { useAuth } from '../context/AuthContext'
import {
  TEACHER_WEEKLY_TIMETABLES,
  lessonHighlight,
  resolveTimetableTeacherId,
  weekdayLabel,
  type DayPeriod,
  type SchoolWeekday,
} from '../data/teacherTimetable'

const WEEKDAYS: SchoolWeekday[] = [1, 2, 3, 4, 5]

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

export function PersonalTimetablePage() {
  const { user } = useAuth()
  const teacherId = resolveTimetableTeacherId(user?.id, user?.role)
  const entry = teacherId ? TEACHER_WEEKLY_TIMETABLES[teacherId] : null

  const lessonCount = useMemo(() => {
    if (!entry) return 0
    return WEEKDAYS.reduce(
      (n, d) => n + entry.weekly[d].filter((p) => p.type === 'lesson').length,
      0,
    )
  }, [entry])

  const rows = useMemo(() => {
    if (!entry) return []
    return buildRows(entry.weekly[1])
  }, [entry])

  if (!entry || !teacherId) {
    return (
      <div className="page">
        <header className="page-header reveal-up">
          <h1>個人時間表</h1>
          <p>你的任教堂次與個人時間表。</p>
        </header>
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">尚未匯入此帳戶的 2026/27 時間表。</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>個人時間表</h1>
        <p>
          {entry.academicYear.label} 學年 · 每週 {lessonCount}{' '}
          節（有效至 {entry.academicYear.teachingUntil}）
        </p>
      </header>

      <GlassPanel className="personal-tt reveal-up delay-1">
        <div className="personal-tt-wrap">
          <table className="personal-tt-table">
            <thead>
              <tr>
                <th scope="col" className="personal-tt-time-head">
                  時間
                </th>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col">
                    {weekdayLabel(d)}
                  </th>
                ))}
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
                        <span className="personal-tt-time-start">{row.start}</span>
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
                      <span className="personal-tt-time-start">{row.start}</span>
                      <span className="personal-tt-time-end">{row.end}</span>
                    </th>
                    {WEEKDAYS.map((d) => {
                      const period = findPeriod(
                        entry.weekly[d],
                        row.start,
                        row.end,
                      )
                      const isFree = period?.type === 'free'
                      const isLesson = period?.type === 'lesson'
                      const hl =
                        isLesson && period.type === 'lesson'
                          ? lessonHighlight(period.group, period.subject)
                          : null
                      return (
                        <td
                          key={d}
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
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
