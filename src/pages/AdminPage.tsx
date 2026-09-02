import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { EVENT_KIND_META, isoDateLocal, SCHOOL_CALENDAR_YEARS } from '../data/calendarEvents'
import {
  academicYearDateRange,
  formatAcademicYearLabel,
  isoInAcademicYear,
} from '../data/academicYear'
import { buildSchoolClasses } from '../data/schoolClasses'
import { teachersForYear } from '../data/staffUsers'
import {
  GRADE_LEVELS,
  gradeLabel,
  latestTeacherWhitelistYear,
  teacherWhitelistYears,
} from '../data/teacherWhitelist'
import type {
  CalendarAudience,
  CalendarEventKind,
  CalendarEventTime,
  GradeDeadline,
} from '../types'

type DeadlineDraft = Omit<GradeDeadline, 'submitted'>

type CalAudienceMode = 'all' | 'grades' | 'teachers'

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

const WEEKDAYS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
] as const

function emptyDraft(grade: number): DeadlineDraft {
  return {
    grade,
    readingDue: '',
    activityTitle: '',
    activityDue: '',
  }
}

function weekdayLabel(iso: string): string {
  if (!iso) return ''
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ''
  return WEEKDAYS[date.getDay()]
}

function listAdminYearStarts(): number[] {
  return [...new Set([...teacherWhitelistYears(), ...SCHOOL_CALENDAR_YEARS])].sort(
    (a, b) => b - a,
  )
}

function defaultDateForYear(startYear: number): string {
  const { from, to } = academicYearDateRange(startYear)
  const today = isoDateLocal()
  if (today >= from && today <= to) return today
  return from
}

function isDeadlineComplete(draft: DeadlineDraft): boolean {
  return Boolean(draft.activityTitle.trim() && draft.activityDue)
}

function missingDeadlineFields(draft: DeadlineDraft): string[] {
  const missing: string[] = []
  if (!draft.activityTitle.trim()) missing.push('活動名稱')
  if (!draft.activityDue) missing.push('活動截止日期')
  return missing
}

type FieldError = { title?: boolean; due?: boolean }

type DialogState =
  | { kind: 'notice'; title: string; message: string }
  | {
      kind: 'confirm'
      title: string
      message: string
      items: string[]
    }

function AdminDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: DialogState
  onClose: () => void
  onConfirm?: () => void
}) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        aria-describedby="admin-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="admin-dialog-title">{dialog.title}</h3>
        <p id="admin-dialog-desc" className="admin-dialog-message">
          {dialog.message}
        </p>
        {dialog.kind === 'confirm' && dialog.items.length > 0 && (
          <ul className="admin-dialog-list">
            {dialog.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="admin-dialog-actions">
          {dialog.kind === 'confirm' ? (
            <>
              <button
                type="button"
                className="admin-dialog-btn ghost"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                className="admin-dialog-btn primary"
                onClick={onConfirm}
              >
                確認遞交
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-dialog-btn primary"
              onClick={onClose}
            >
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SubmitTick({
  id,
  checked,
  disabled,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <div className="deadline-check deadline-submit-check">
      <input
        id={id}
        type="checkbox"
        className="task-checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="checkbox-label" htmlFor={id}>
        <span className="checkbox-box" aria-hidden>
          <span className="checkbox-fill" />
          <span className="success-ripple" />
          <span className="checkmark">
            <svg className="check-icon" viewBox="0 0 24 24">
              <path d="M9.00001 16.17L4.83001 12L3.41001 13.41L9.00001 19L21 7.00001L19.59 5.59001L9.00001 16.17Z" />
            </svg>
          </span>
        </span>
        <span className="sr-only">{label}</span>
      </label>
    </div>
  )
}

export function AdminPage() {
  const { user } = useAuth()
  const {
    classes,
    students,
    assignClassToTeacher,
    gradeDeadlines,
    updateGradeDeadline,
    submitGradeDeadlines,
    addCalendarEventsBatch,
    scoresAcademicYearStart,
  } = useCampus()

  const yearOptions = useMemo(() => listAdminYearStarts(), [])
  const defaultStart = useMemo(() => latestTeacherWhitelistYear(), [])
  const [startYear, setStartYear] = useState(defaultStart)
  const yearRange = useMemo(
    () => academicYearDateRange(startYear),
    [startYear],
  )
  const yearLabel = formatAcademicYearLabel(startYear)
  const yearTeachers = useMemo(() => teachersForYear(startYear), [startYear])
  const yearClasses = useMemo(() => {
    const catalog = buildSchoolClasses(startYear)
    if (startYear !== scoresAcademicYearStart) return catalog
    const assigned = new Map(classes.map((c) => [c.id, c.teacherId]))
    return catalog.map((cls) => ({
      ...cls,
      teacherId: assigned.get(cls.id) ?? cls.teacherId,
    }))
  }, [startYear, scoresAcademicYearStart, classes])
  const canAssignClasses = startYear === scoresAcademicYearStart

  const [drafts, setDrafts] = useState<Record<number, DeadlineDraft>>(() => {
    const init: Record<number, DeadlineDraft> = {}
    for (const grade of GRADE_LEVELS) {
      const row = gradeDeadlines.find((d) => d.grade === grade)
      init[grade] = row
        ? {
            grade,
            readingDue: '',
            activityTitle: row.activityTitle,
            activityDue: row.activityDue,
          }
        : emptyDraft(grade)
    }
    return init
  })
  const [selected, setSelected] = useState<Set<number>>(
    () =>
      new Set(
        gradeDeadlines.filter((d) => d.submitted).map((d) => d.grade),
      ),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<number, FieldError>>(
    {},
  )
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const [calTitle, setCalTitle] = useState('')
  const [calDate, setCalDate] = useState(() => defaultDateForYear(defaultStart))
  const [calDateEnd, setCalDateEnd] = useState('')
  const [calKind, setCalKind] = useState<CalendarEventKind>('department')
  const [calAudienceMode, setCalAudienceMode] =
    useState<CalAudienceMode>('all')
  const [calGrades, setCalGrades] = useState<Set<number>>(new Set())
  const [calTeacherIds, setCalTeacherIds] = useState<Set<string>>(new Set())
  const [calStartTime, setCalStartTime] = useState('')
  const [calEndTime, setCalEndTime] = useState('')
  const [calNotice, setCalNotice] = useState<string | null>(null)

  if (user?.role !== 'admin') return <Navigate to="/progress" replace />

  const teacherCards = yearTeachers.map((t) => {
    const owned = yearClasses.filter(
      (c) => c.teacherId === t.id || t.classIds.includes(c.id),
    )
    return { teacher: t, owned }
  })

  const onSelectYear = (next: number) => {
    setStartYear(next)
    setCalTeacherIds(new Set())
    setCalNotice(null)
    const range = academicYearDateRange(next)
    setCalDate((prev) =>
      isoInAcademicYear(prev, next) ? prev : defaultDateForYear(next),
    )
    setCalDateEnd((prev) => {
      if (!prev) return prev
      if (isoInAcademicYear(prev, next) && prev >= range.from) return prev
      return ''
    })
  }

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

  const patchDraft = (grade: number, patch: Partial<DeadlineDraft>) => {
    const nextDraft: DeadlineDraft = {
      ...(drafts[grade] ?? emptyDraft(grade)),
      ...patch,
      grade,
      readingDue: '',
    }
    setDrafts((prev) => ({
      ...prev,
      [grade]: nextDraft,
    }))
    setFieldErrors((prev) => {
      const cur = prev[grade]
      if (!cur) return prev
      const nextErr: FieldError = {
        title: cur.title && !nextDraft.activityTitle.trim() ? true : undefined,
        due: cur.due && !nextDraft.activityDue ? true : undefined,
      }
      if (!nextErr.title && !nextErr.due) {
        const { [grade]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [grade]: nextErr }
    })
    if (!isDeadlineComplete(nextDraft)) {
      setSelected((prev) => {
        if (!prev.has(grade)) return prev
        const next = new Set(prev)
        next.delete(grade)
        return next
      })
    }
    const saved = gradeDeadlines.find((d) => d.grade === grade)
    if (saved?.submitted && !isDeadlineComplete(nextDraft)) {
      updateGradeDeadline(grade, { submitted: false })
    }
  }

  const onSelectToggle = (grade: number, on: boolean) => {
    if (!on) {
      setSelected((prev) => {
        if (!prev.has(grade)) return prev
        const next = new Set(prev)
        next.delete(grade)
        return next
      })
      return
    }
    const draft = drafts[grade] ?? emptyDraft(grade)
    const missing = missingDeadlineFields(draft)
    if (missing.length > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        [grade]: {
          title: !draft.activityTitle.trim() || undefined,
          due: !draft.activityDue || undefined,
        },
      }))
      return
    }
    setFieldErrors((prev) => {
      if (!prev[grade]) return prev
      const { [grade]: _, ...rest } = prev
      return rest
    })
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(grade)
      return next
    })
  }

  const onSelectAll = () => {
    setSelected(
      new Set(
        GRADE_LEVELS.filter((grade) =>
          isDeadlineComplete(drafts[grade] ?? emptyDraft(grade)),
        ),
      ),
    )
  }

  const performSubmit = () => {
    submitGradeDeadlines(
      GRADE_LEVELS.map((grade) => {
        const draft = drafts[grade] ?? emptyDraft(grade)
        const complete = isDeadlineComplete(draft)
        return {
          grade,
          readingDue: '',
          activityTitle: draft.activityTitle,
          activityDue: draft.activityDue,
          submitted: selected.has(grade) && complete,
        }
      }),
    )
    const cleared: Record<number, DeadlineDraft> = {}
    for (const grade of GRADE_LEVELS) {
      cleared[grade] = emptyDraft(grade)
    }
    setDrafts(cleared)
    setSelected(new Set())
    setFieldErrors({})
    setDialog(null)
  }

  const onSubmitAll = () => {
    const toSubmit = GRADE_LEVELS.filter((grade) => {
      const draft = drafts[grade] ?? emptyDraft(grade)
      return selected.has(grade) && isDeadlineComplete(draft)
    })
    if (toSubmit.length === 0) {
      setDialog({
        kind: 'notice',
        title: '尚未選取項目',
        message: '請先勾選已填妥活動名稱與截止日期的年級，再遞交。',
      })
      return
    }
    setDialog({
      kind: 'confirm',
      title: '確認遞交',
      message: `確定遞交以下 ${toSubmit.length} 項截止日期給相應任教老師？`,
      items: toSubmit.map((grade) => {
        const draft = drafts[grade] ?? emptyDraft(grade)
        const weekday = weekdayLabel(draft.activityDue)
        return `${gradeLabel(grade)}｜${draft.activityTitle.trim()}｜${draft.activityDue}${weekday ? `（${weekday}）` : ''}`
      }),
    })
  }

  return (
    <div className="page admin-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>分派</h1>
          <p>
            {yearLabel}學年 · 檢視該年教師與任教班別；批量加入的活動會進入該學年日曆（
            {yearRange.from} 至 {yearRange.to}）。
          </p>
        </div>
        <ScoresYearSelect
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={onSelectYear}
          id="admin-academic-year"
        />
      </header>

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">教師人數</p>
          <p className="metric-value">{yearTeachers.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">任教多班</p>
          <p className="metric-value">
            {teacherCards.filter((t) => t.owned.length > 1).length}
          </p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">班級總數</p>
          <p className="metric-value">{yearClasses.length}</p>
        </GlassPanel>
      </div>

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

      <GlassPanel className="table-panel deadline-admin reveal-up delay-1">
        <div className="table-panel-head">
          <h2>年級截止日期</h2>
          <div className="deadline-admin-actions">
            <button
              type="button"
              className="deadline-select-all-btn"
              onClick={onSelectAll}
            >
              全選
            </button>
            <button
              type="button"
              className="deadline-submit-btn"
              onClick={onSubmitAll}
            >
              遞交
            </button>
          </div>
        </div>
        <p className="deadline-admin-lead">
          為每級設定活動名稱與截止日期；填妥兩者後才可勾選並遞交。未填妥時勾選會以紅色邊框標示空白欄位。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>年級</th>
                <th>活動名稱</th>
                <th>活動截止</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_LEVELS.map((grade) => {
                const draft = drafts[grade] ?? emptyDraft(grade)
                const complete = isDeadlineComplete(draft)
                const checked = selected.has(grade) && complete
                const weekday = weekdayLabel(draft.activityDue)
                const errors = fieldErrors[grade]
                return (
                  <tr
                    key={grade}
                    className={checked ? 'deadline-row-selected' : ''}
                  >
                    <td>{gradeLabel(grade)}</td>
                    <td>
                      <input
                        type="text"
                        className={`deadline-input text${errors?.title ? ' invalid' : ''}`}
                        placeholder="例如：書展參觀"
                        value={draft.activityTitle}
                        aria-invalid={Boolean(errors?.title)}
                        onChange={(e) =>
                          patchDraft(grade, {
                            activityTitle: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="deadline-due-cell">
                        <input
                          type="date"
                          className={`deadline-input${errors?.due ? ' invalid' : ''}`}
                          value={draft.activityDue}
                          aria-invalid={Boolean(errors?.due)}
                          onChange={(e) =>
                            patchDraft(grade, {
                              activityDue: e.target.value,
                            })
                          }
                        />
                        <span
                          className={`deadline-weekday${weekday ? '' : ' empty'}`}
                          aria-live="polite"
                        >
                          {weekday || '—'}
                        </span>
                        <SubmitTick
                          id={`deadline-select-${grade}`}
                          checked={checked}
                          onChange={(next) => onSelectToggle(grade, next)}
                          label={
                            checked
                              ? `取消選取 ${gradeLabel(grade)}`
                              : `選取 ${gradeLabel(grade)}`
                          }
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {dialog && (
        <AdminDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onConfirm={dialog.kind === 'confirm' ? performSubmit : undefined}
        />
      )}

      <div className="admin-layout reveal-up delay-2">
        <GlassPanel className="table-panel">
          <h2>班級分派</h2>
          {!canAssignClasses && (
            <p className="deadline-admin-lead">
              此學年任教班別依白名單顯示；班級教師下拉僅在成績學年（
              {formatAcademicYearLabel(scoresAcademicYearStart)}）可改。
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>班級</th>
                  <th>年級</th>
                  <th>學生人數</th>
                  <th>教師</th>
                </tr>
              </thead>
              <tbody>
                {yearClasses.map((cls) => {
                  const rosterCount = canAssignClasses
                    ? students.filter((s) => s.classId === cls.id).length
                    : null
                  const teacherName =
                    yearTeachers.find((t) => t.id === cls.teacherId)?.name ??
                    '未分派'
                  return (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.grade}</td>
                    <td>{rosterCount == null ? '—' : rosterCount}</td>
                    <td>
                      {canAssignClasses ? (
                      <select
                        className="assign-select"
                        value={cls.teacherId ?? ''}
                        onChange={(e) =>
                          assignClassToTeacher(
                            cls.id,
                            e.target.value || null,
                          )
                        }
                      >
                        <option value="">未分派</option>
                        {yearTeachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      ) : (
                        teacherName
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel className="teacher-roll">
          <h2>教師名單</h2>
          <ul className="teacher-list">
            {teacherCards.map(({ teacher: t, owned }) => (
              <li key={t.id}>
                <div className="teacher-card-head">
                  <p className="teacher-name">{t.name}</p>
                  <p className="teacher-meta">{owned.length} 班</p>
                </div>
                {owned.length === 0 ? (
                  <p className="teacher-classes">尚未分派班級</p>
                ) : (
                  <div className="teacher-class-buttons">
                    {owned.map((c) => (
                      <span key={c.id} className="class-btn selected static">
                        <span>{c.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="teacher-handle">{t.username}</p>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </div>
  )
}
