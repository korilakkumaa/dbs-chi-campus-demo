import { useEffect, useState } from 'react'
import { GlassPanel } from '../GlassPanel'
import { EVENT_KIND_META } from '../../data/calendarEvents'
import { isoInAcademicYear } from '../../data/academicYear'
import { GRADE_LEVELS, gradeLabel } from '../../data/teacherWhitelist'
import type {
  CalendarAudience,
  CalendarEventKind,
  CalendarEventTime,
  User,
} from '../../types'
import type { CalAudienceMode } from './adminHelpers'

const CAL_KIND_ORDER: CalendarEventKind[] = [
  'holiday',
  'non-school-day',
  'school-day',
  'timetable',
  'event',
  'progress',
  'department',
  'assessment',
]

type Props = {
  startYear: number
  yearLabel: string
  yearRange: { from: string; to: string }
  yearTeachers: User[]
  defaultDate: string
  addCalendarEventsBatch: (input: {
    title: string
    date: string
    dateEnd?: string
    kind: CalendarEventKind
    audience: Exclude<CalendarAudience, { type: 'personal' }>
    schoolYearStart: number
    time?: CalendarEventTime
  }) => number
}

export function AdminCalendarBatchPanel({
  startYear,
  yearLabel,
  yearRange,
  yearTeachers,
  defaultDate,
  addCalendarEventsBatch,
}: Props) {
  const [calTitle, setCalTitle] = useState('')
  const [calDate, setCalDate] = useState(defaultDate)
  const [calDateEnd, setCalDateEnd] = useState('')
  const [calKind, setCalKind] = useState<CalendarEventKind>('department')
  const [calAudienceMode, setCalAudienceMode] =
    useState<CalAudienceMode>('all')
  const [calGrades, setCalGrades] = useState<Set<number>>(new Set())
  const [calTeacherIds, setCalTeacherIds] = useState<Set<string>>(new Set())
  const [calStartTime, setCalStartTime] = useState('')
  const [calEndTime, setCalEndTime] = useState('')
  const [calNotice, setCalNotice] = useState<string | null>(null)

  useEffect(() => {
    setCalTeacherIds(new Set())
    setCalNotice(null)
    setCalDate((prev) =>
      isoInAcademicYear(prev, startYear) ? prev : defaultDate,
    )
    setCalDateEnd((prev) => {
      if (!prev) return prev
      if (isoInAcademicYear(prev, startYear) && prev >= yearRange.from) return prev
      return ''
    })
  }, [startYear, defaultDate, yearRange.from])

  const calendarTimePayload = (): CalendarEventTime | undefined => {
    if (!calStartTime && !calEndTime) return undefined
    if (!calStartTime || !calEndTime) return undefined
    if (calStartTime >= calEndTime) return undefined
    return { start: calStartTime, end: calEndTime }
  }

  const submitCalendarBatch = () => {
    const trimmed = calTitle.trim()
    if (!trimmed || !calDate) {
      setCalNotice('請填寫事件名稱與日期。')
      return
    }
    if ((calStartTime && !calEndTime) || (!calStartTime && calEndTime)) {
      setCalNotice('請同時填寫開始與結束時間，或兩者皆留空（全天）。')
      return
    }
    if (calStartTime && calEndTime && calStartTime >= calEndTime) {
      setCalNotice('結束時間須晚於開始時間。')
      return
    }
    if (calDateEnd && calDateEnd < calDate) {
      setCalNotice('結束日期不可早於開始日期。')
      return
    }
    if (calAudienceMode === 'grades' && calGrades.size === 0) {
      setCalNotice('請至少選一個年級。')
      return
    }
    if (calAudienceMode === 'teachers' && calTeacherIds.size === 0) {
      setCalNotice('請至少選一位教師。')
      return
    }
    if (
      !isoInAcademicYear(calDate, startYear) ||
      (calDateEnd && !isoInAcademicYear(calDateEnd, startYear))
    ) {
      setCalNotice(
        `日期須屬於 ${yearLabel} 學年（${yearRange.from} 至 ${yearRange.to}）。`,
      )
      return
    }
    let audience: Exclude<CalendarAudience, { type: 'personal' }>
    if (calAudienceMode === 'all') {
      audience = { type: 'all' }
    } else if (calAudienceMode === 'grades') {
      audience = {
        type: 'grades',
        grades: Array.from(calGrades).sort((a, b) => a - b),
      }
    } else {
      audience = {
        type: 'teachers',
        teacherIds: Array.from(calTeacherIds),
      }
    }
    const time = calendarTimePayload()
    const count = addCalendarEventsBatch({
      title: trimmed,
      date: calDate,
      dateEnd: calDateEnd || undefined,
      kind: calKind,
      audience,
      schoolYearStart: startYear,
      time,
    })
    setCalTitle('')
    setCalDateEnd('')
    setCalStartTime('')
    setCalEndTime('')
    setCalNotice(
      count > 1
        ? `已加入 ${yearLabel} 學年日曆 ${count} 天。`
        : `已加入 ${yearLabel} 學年日曆。`,
    )
  }

  return (
    <GlassPanel className="table-panel cal-admin reveal-up delay-1">
      <div className="table-panel-head">
        <h2>批量加入月曆</h2>
        <button
          type="button"
          className="deadline-submit-btn"
          onClick={submitCalendarBatch}
        >
          加入
        </button>
      </div>
      <p className="deadline-admin-lead">
        一次將事件推送到 {yearLabel} 學年的全部教師、指定年級，或該年任教老師的月曆；可選時段，會同步至網站日曆與外部訂閱（ICS／Google）。
      </p>
      <div className="cal-admin-form">
        <label className="cal-admin-field">
          <span>事件名稱</span>
          <input
            type="text"
            className="deadline-input text"
            value={calTitle}
            placeholder="例如：中文科組會議"
            onChange={(e) => {
              setCalTitle(e.target.value)
              setCalNotice(null)
            }}
          />
        </label>
        <fieldset className="cal-admin-schedule">
          <legend>日期與時間</legend>
          <div className="cal-admin-date-row">
            <label className="cal-admin-field">
              <span>由</span>
              <input
                type="date"
                className="deadline-input"
                value={calDate}
                min={yearRange.from}
                max={yearRange.to}
                onChange={(e) => {
                  setCalDate(e.target.value)
                  setCalNotice(null)
                }}
              />
            </label>
            <label className="cal-admin-field">
              <span>至（可留空）</span>
              <input
                type="date"
                className="deadline-input"
                value={calDateEnd}
                min={yearRange.from}
                max={yearRange.to}
                onChange={(e) => {
                  setCalDateEnd(e.target.value)
                  setCalNotice(null)
                }}
              />
            </label>
          </div>
          <div className="cal-admin-time-row">
            <label className="cal-admin-field cal-admin-time-field">
              <span>開始時間</span>
              <input
                type="time"
                className="deadline-input"
                value={calStartTime}
                onChange={(e) => {
                  setCalStartTime(e.target.value)
                  setCalNotice(null)
                }}
              />
            </label>
            <label className="cal-admin-field cal-admin-time-field">
              <span>結束時間</span>
              <input
                type="time"
                className="deadline-input"
                value={calEndTime}
                onChange={(e) => {
                  setCalEndTime(e.target.value)
                  setCalNotice(null)
                }}
              />
            </label>
            <p className="cal-admin-time-hint">時間留空 = 全天事件</p>
          </div>
        </fieldset>
        <fieldset className="cal-admin-field">
          <legend>類型</legend>
          <div className="cal-admin-kinds">
            {CAL_KIND_ORDER.map((k) => (
              <label key={k} className="cal-admin-kind">
                <input
                  type="radio"
                  name="cal-kind"
                  checked={calKind === k}
                  onChange={() => setCalKind(k)}
                />
                <span
                  className="cal-admin-kind-dot"
                  style={{ background: EVENT_KIND_META[k].color }}
                />
                {EVENT_KIND_META[k].label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="cal-admin-field">
          <legend>對象</legend>
          <div className="cal-admin-audience">
            {(
              [
                ['all', '全部教師'],
                ['grades', '按級別'],
                ['teachers', '按老師'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="cal-admin-audience-opt">
                <input
                  type="radio"
                  name="cal-audience"
                  checked={calAudienceMode === mode}
                  onChange={() => setCalAudienceMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
          {calAudienceMode === 'grades' && (
            <div className="cal-admin-chips">
              {GRADE_LEVELS.map((g) => {
                const on = calGrades.has(g)
                return (
                  <button
                    key={g}
                    type="button"
                    className={`cal-admin-chip${on ? ' active' : ''}`}
                    onClick={() => {
                      setCalGrades((prev) => {
                        const next = new Set(prev)
                        if (next.has(g)) next.delete(g)
                        else next.add(g)
                        return next
                      })
                    }}
                  >
                    {gradeLabel(g)}
                  </button>
                )
              })}
            </div>
          )}
          {calAudienceMode === 'teachers' && (
            <div className="cal-admin-chips">
              {yearTeachers.map((t) => {
                const on = calTeacherIds.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`cal-admin-chip${on ? ' active' : ''}`}
                    onClick={() => {
                      setCalTeacherIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }}
                  >
                    {t.name.replace(/老師$/, '')}
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>
        {calNotice && <p className="cal-admin-notice">{calNotice}</p>}
      </div>
    </GlassPanel>
  )
}
