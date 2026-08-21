import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { EVENT_KIND_META, isoDateLocal } from '../data/calendarEvents'
import { GRADE_LEVELS, gradeLabel } from '../data/teacherWhitelist'
import type { CalendarAudience, CalendarEventKind, GradeDeadline } from '../types'

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

const DAY_STATUS_KINDS = [
  'school-day',
  'non-school-day',
  'holiday',
] as const satisfies readonly CalendarEventKind[]

const DAY_STATUS_DEFAULT_TITLE: Record<
  (typeof DAY_STATUS_KINDS)[number],
  string
> = {
  'school-day': '正常上課日',
  'non-school-day': '非正常上課日',
  holiday: '假期',
}

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
    teachers,
    students,
    assignClassToTeacher,
    gradeDeadlines,
    updateGradeDeadline,
    submitGradeDeadlines,
    addCalendarEventsBatch,
  } = useCampus()

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
  const [calDate, setCalDate] = useState(isoDateLocal)
  const [calDateEnd, setCalDateEnd] = useState('')
  const [calKind, setCalKind] = useState<CalendarEventKind>('department')
  const [calAudienceMode, setCalAudienceMode] =
    useState<CalAudienceMode>('all')
  const [calGrades, setCalGrades] = useState<Set<number>>(new Set())
  const [calTeacherIds, setCalTeacherIds] = useState<Set<string>>(new Set())
  const [calNotice, setCalNotice] = useState<string | null>(null)

  const [dayStatusKind, setDayStatusKind] =
    useState<(typeof DAY_STATUS_KINDS)[number]>('non-school-day')
  const [dayStatusTitle, setDayStatusTitle] = useState('')
  const [dayStatusFrom, setDayStatusFrom] = useState(isoDateLocal)
  const [dayStatusTo, setDayStatusTo] = useState('')
  const [dayStatusWeekdaysOnly, setDayStatusWeekdaysOnly] = useState(true)
  const [dayStatusAudienceMode, setDayStatusAudienceMode] = useState<
    'all' | 'teachers'
  >('all')
  const [dayStatusTeacherIds, setDayStatusTeacherIds] = useState<Set<string>>(
    new Set(),
  )
  const [dayStatusNotice, setDayStatusNotice] = useState<string | null>(null)

  if (user?.role !== 'admin') return <Navigate to="/progress" replace />

  const teacherCards = teachers.map((t) => {
    const owned = classes.filter(
      (c) => c.teacherId === t.id || t.classIds.includes(c.id),
    )
    return { teacher: t, owned }
  })

  const submitCalendarBatch = () => {
    const trimmed = calTitle.trim()
    if (!trimmed || !calDate) {
      setCalNotice('請填寫事件名稱與日期。')
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
    const count = addCalendarEventsBatch({
      title: trimmed,
      date: calDate,
      dateEnd: calDateEnd || undefined,
      kind: calKind,
      audience,
    })
    setCalTitle('')
    setCalDateEnd('')
    setCalNotice(count > 1 ? `已加入 ${count} 天的月曆事件。` : '已加入月曆事件。')
  }

  const submitDayStatusBatch = () => {
    if (!dayStatusFrom) {
      setDayStatusNotice('請選擇開始日期。')
      return
    }
    if (dayStatusTo && dayStatusTo < dayStatusFrom) {
      setDayStatusNotice('結束日期不可早於開始日期。')
      return
    }
    if (
      dayStatusAudienceMode === 'teachers' &&
      dayStatusTeacherIds.size === 0
    ) {
      setDayStatusNotice('請至少選一位教師。')
      return
    }
    const title =
      dayStatusTitle.trim() || DAY_STATUS_DEFAULT_TITLE[dayStatusKind]
    const audience: Exclude<CalendarAudience, { type: 'personal' }> =
      dayStatusAudienceMode === 'all'
        ? { type: 'all' }
        : {
            type: 'teachers',
            teacherIds: Array.from(dayStatusTeacherIds),
          }
    const count = addCalendarEventsBatch({
      title,
      date: dayStatusFrom,
      dateEnd: dayStatusTo || undefined,
      kind: dayStatusKind,
      audience,
      weekdaysOnly: dayStatusWeekdaysOnly,
    })
    if (count === 0) {
      setDayStatusNotice('所選範圍沒有可套用的日期。')
      return
    }
    setDayStatusTitle('')
    setDayStatusTo('')
    setDayStatusNotice(
      `已標記 ${count} 日為「${EVENT_KIND_META[dayStatusKind].label}」。`,
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
      <header className="page-header reveal-up">
        <h1>分派</h1>
        <p>將班級分配予教師；亦可為各年級統一設定截止日期。</p>
      </header>

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">教師人數</p>
          <p className="metric-value">{teachers.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">任教多班</p>
          <p className="metric-value">
            {teacherCards.filter((t) => t.owned.length > 1).length}
          </p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">班級總數</p>
          <p className="metric-value">{classes.length}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="table-panel cal-admin reveal-up delay-1">
        <div className="table-panel-head">
          <h2>上課日／假期批量設定</h2>
          <button
            type="button"
            className="deadline-submit-btn"
            onClick={submitDayStatusBatch}
          >
            套用
          </button>
        </div>
        <p className="deadline-admin-lead">
          一次為多日、全部或指定教師標記正常上課日、非正常上課日或假期；會影響詳細日曆左側時間表是否顯示。
        </p>
        <div className="cal-admin-form">
          <fieldset className="cal-admin-field">
            <legend>日曆狀態</legend>
            <div className="cal-admin-kinds">
              {DAY_STATUS_KINDS.map((k) => (
                <label key={k} className="cal-admin-kind">
                  <input
                    type="radio"
                    name="day-status-kind"
                    checked={dayStatusKind === k}
                    onChange={() => {
                      setDayStatusKind(k)
                      setDayStatusNotice(null)
                    }}
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
          <label className="cal-admin-field">
            <span>說明（可留空）</span>
            <input
              type="text"
              className="deadline-input text"
              value={dayStatusTitle}
              placeholder={DAY_STATUS_DEFAULT_TITLE[dayStatusKind]}
              onChange={(e) => {
                setDayStatusTitle(e.target.value)
                setDayStatusNotice(null)
              }}
            />
          </label>
          <div className="cal-admin-date-row">
            <label className="cal-admin-field">
              <span>由</span>
              <input
                type="date"
                className="deadline-input"
                value={dayStatusFrom}
                onChange={(e) => {
                  setDayStatusFrom(e.target.value)
                  setDayStatusNotice(null)
                }}
              />
            </label>
            <label className="cal-admin-field">
              <span>至</span>
              <input
                type="date"
                className="deadline-input"
                value={dayStatusTo}
                onChange={(e) => {
                  setDayStatusTo(e.target.value)
                  setDayStatusNotice(null)
                }}
              />
            </label>
          </div>
          <label className="cal-admin-weekdays">
            <input
              type="checkbox"
              checked={dayStatusWeekdaysOnly}
              onChange={(e) => setDayStatusWeekdaysOnly(e.target.checked)}
            />
            只套用星期一至五
          </label>
          <fieldset className="cal-admin-field">
            <legend>對象</legend>
            <div className="cal-admin-audience">
              {(
                [
                  ['all', '全部教師'],
                  ['teachers', '指定教師'],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="cal-admin-audience-opt">
                  <input
                    type="radio"
                    name="day-status-audience"
                    checked={dayStatusAudienceMode === mode}
                    onChange={() => setDayStatusAudienceMode(mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {dayStatusAudienceMode === 'teachers' && (
              <div className="cal-admin-chips">
                {teachers.map((t) => {
                  const on = dayStatusTeacherIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`cal-admin-chip${on ? ' active' : ''}`}
                      onClick={() => {
                        setDayStatusTeacherIds((prev) => {
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
          {dayStatusNotice && (
            <p className="cal-admin-notice" role="status">
              {dayStatusNotice}
            </p>
          )}
        </div>
      </GlassPanel>

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
          一次將事件推送到全部教師、指定年級，或個別教師的月曆。
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
          <div className="cal-admin-date-row">
            <label className="cal-admin-field">
              <span>由</span>
              <input
                type="date"
                className="deadline-input"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
              />
            </label>
            <label className="cal-admin-field">
              <span>至（可留空）</span>
              <input
                type="date"
                className="deadline-input"
                value={calDateEnd}
                onChange={(e) => setCalDateEnd(e.target.value)}
              />
            </label>
          </div>
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
                {teachers.map((t) => {
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
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.grade}</td>
                    <td>
                      {students.filter((s) => s.classId === cls.id).length}
                    </td>
                    <td>
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
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
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
