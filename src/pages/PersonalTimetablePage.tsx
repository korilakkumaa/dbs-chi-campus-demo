import { useMemo, useState, type CSSProperties } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { useAuth } from '../context/AuthContext'
import {
  TEACHER_WEEKLY_TIMETABLES,
  classHighlight,
  resolveTimetableTeacherId,
  weekdayLabel,
  type DayPeriod,
  type SchoolWeekday,
} from '../data/teacherTimetable'

const WEEKDAYS: SchoolWeekday[] = [1, 2, 3, 4, 5]

function periodLabel(p: DayPeriod): string {
  if (p.type === 'break') return p.label ?? '休息'
  if (p.type === 'free') return '空堂'
  return [p.group, p.subject, p.room].filter(Boolean).join(' · ')
}

export function PersonalTimetablePage() {
  const { user } = useAuth()
  const teacherId = resolveTimetableTeacherId(user?.id, user?.role)
  const entry = teacherId ? TEACHER_WEEKLY_TIMETABLES[teacherId] : null
  const [day, setDay] = useState<SchoolWeekday>(1)

  const periods = entry?.weekly[day] ?? []

  const lessonCount = useMemo(() => {
    if (!entry) return 0
    return WEEKDAYS.reduce(
      (n, d) => n + entry.weekly[d].filter((p) => p.type === 'lesson').length,
      0,
    )
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
        <div className="personal-tt-days" role="tablist" aria-label="星期">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === d}
              className={`personal-tt-day${day === d ? ' active' : ''}`}
              onClick={() => setDay(d)}
            >
              {weekdayLabel(d)}
            </button>
          ))}
        </div>

        <ul className="day-tt-list personal-tt-list">
          {periods.map((p, i) => {
            if (p.type === 'lesson') {
              const hl = classHighlight(p.group)
              return (
                <li
                  key={`${p.start}-${i}`}
                  className="day-tt-row lesson"
                  style={
                    {
                      '--tt-accent': hl.accent,
                      '--tt-soft': hl.soft,
                      '--tt-text': hl.text,
                    } as CSSProperties
                  }
                >
                  <span className="day-tt-time">
                    <span className="day-tt-time-start">{p.start}</span>
                    <span className="day-tt-time-end">{p.end}</span>
                  </span>
                  <span className="day-tt-body">
                    <span className="day-tt-group">{p.group}</span>
                    <span className="day-tt-meta">
                      {p.subject}
                      {p.room ? ` · ${p.room}` : ''}
                    </span>
                  </span>
                </li>
              )
            }
            return (
              <li
                key={`${p.start}-${i}`}
                className={`day-tt-row ${p.type}`}
              >
                <span className="day-tt-time">
                  <span className="day-tt-time-start">{p.start}</span>
                  <span className="day-tt-time-end">{p.end}</span>
                </span>
                <span className="day-tt-body">
                  <span className="day-tt-break-label">{periodLabel(p)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </GlassPanel>
    </div>
  )
}
