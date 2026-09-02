import { useState } from 'react'
import { EVENT_KIND_META } from '../../data/calendarEvents'
import { useCampus } from '../../context/CampusContext'
import { GRADE_LEVELS, gradeLabel } from '../../data/teacherWhitelist'
import type { CalendarAudience, CalendarEventKind } from '../../types'

type AudienceMode = 'all' | 'grades' | 'teachers'

const DAY_STATUS_KINDS = [
  'school-day',
  'non-school-day',
  'holiday',
] as const satisfies readonly CalendarEventKind[]

const CUSTOM_KINDS: CalendarEventKind[] = [
  'event',
  'timetable',
  'department',
  'assessment',
]

type Props = {
  selectedDates: Set<string>
  onClearSelection: () => void
}

export function CalendarDayStatusPanel({
  selectedDates,
  onClearSelection,
}: Props) {
  const { teachers, addCalendarEventsBatch } = useCampus()

  const [dayStatusKind, setDayStatusKind] =
    useState<(typeof DAY_STATUS_KINDS)[number]>('holiday')
  const [customKind, setCustomKind] = useState<CalendarEventKind>('event')
  const [useCustomKind, setUseCustomKind] = useState(false)
  const [dayStatusTitle, setDayStatusTitle] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all')
  const [grades, setGrades] = useState<Set<number>>(new Set())
  const [teacherIds, setTeacherIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)

  const sortedDates = Array.from(selectedDates).sort()
  const count = sortedDates.length
  const activeKind = useCustomKind ? customKind : dayStatusKind

  const apply = () => {
    if (count === 0) {
      setNotice('請先在月曆上選取至少一日。')
      return
    }
    if (audienceMode === 'grades' && grades.size === 0) {
      setNotice('請至少選一個級別。')
      return
    }
    if (audienceMode === 'teachers' && teacherIds.size === 0) {
      setNotice('請至少選一位教師。')
      return
    }
    const title = dayStatusTitle.trim()
    if (useCustomKind && !title) {
      setNotice('自訂類型請填寫說明。')
      return
    }
    const resolvedTitle =
      title ||
      (useCustomKind ? EVENT_KIND_META[customKind].label : '')
    let audience: Exclude<CalendarAudience, { type: 'personal' }>
    if (audienceMode === 'all') {
      audience = { type: 'all' }
    } else if (audienceMode === 'grades') {
      audience = {
        type: 'grades',
        grades: Array.from(grades).sort((a, b) => a - b),
      }
    } else {
      audience = { type: 'teachers', teacherIds: Array.from(teacherIds) }
    }

    let total = 0
    for (const iso of sortedDates) {
      total += addCalendarEventsBatch({
        title: resolvedTitle,
        date: iso,
        kind: activeKind,
        audience,
      })
    }

    if (total === 0) {
      setNotice('未能套用所選日期。')
      return
    }
    setDayStatusTitle('')
    setNotice(
      count === 1
        ? `已標記 ${sortedDates[0]} 為「${EVENT_KIND_META[activeKind].label}」。`
        : `已標記 ${count} 日為「${EVENT_KIND_META[activeKind].label}」。`,
    )
    onClearSelection()
  }

  return (
    <div className="detail-cal-admin-panel">
      <div className="detail-cal-admin-head">
        <h2>日期標記</h2>
        {count > 0 && (
          <button
            type="button"
            className="detail-cal-admin-clear"
            onClick={onClearSelection}
          >
            清除
          </button>
        )}
      </div>
      <p className="detail-cal-admin-lead">
        在月曆拖選或 Ctrl／⌘ 多選日期，再選擇類型並套用。假期／非正常上課日若說明留空，教師日曆只顯示顏色、不顯示文字。
      </p>

      <p className="detail-cal-admin-count" aria-live="polite">
        {count === 0 ? '尚未選取日期' : `已選 ${count} 日`}
      </p>

      {count > 0 && count <= 8 && (
        <ul className="detail-cal-admin-dates">
          {sortedDates.map((iso) => (
            <li key={iso}>{iso}</li>
          ))}
        </ul>
      )}

      <fieldset className="detail-cal-admin-field">
        <legend>日曆狀態</legend>
        <div className="detail-cal-admin-kinds">
          {DAY_STATUS_KINDS.map((k) => (
            <label key={k} className="detail-cal-admin-kind">
              <input
                type="radio"
                name="cal-day-status-kind"
                checked={!useCustomKind && dayStatusKind === k}
                onChange={() => {
                  setUseCustomKind(false)
                  setDayStatusKind(k)
                  setNotice(null)
                }}
              />
              <span
                className="detail-cal-admin-kind-dot"
                style={{ background: EVENT_KIND_META[k].color }}
              />
              {EVENT_KIND_META[k].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="detail-cal-admin-field">
        <legend>
          <label className="detail-cal-admin-custom-toggle">
            <input
              type="checkbox"
              checked={useCustomKind}
              onChange={(e) => {
                setUseCustomKind(e.target.checked)
                setNotice(null)
              }}
            />
            其他自訂類型
          </label>
        </legend>
        {useCustomKind && (
          <div className="detail-cal-admin-kinds">
            {CUSTOM_KINDS.map((k) => (
              <label key={k} className="detail-cal-admin-kind">
                <input
                  type="radio"
                  name="cal-day-custom-kind"
                  checked={customKind === k}
                  onChange={() => {
                    setCustomKind(k)
                    setNotice(null)
                  }}
                />
                <span
                  className="detail-cal-admin-kind-dot"
                  style={{ background: EVENT_KIND_META[k].color }}
                />
                {EVENT_KIND_META[k].label}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="detail-cal-admin-field">
        <span>說明（可留空）</span>
        <input
          type="text"
          className="deadline-input text"
          value={dayStatusTitle}
          placeholder={
            useCustomKind
              ? EVENT_KIND_META[customKind].label
              : '留空則只以顏色標記（不顯示文字）'
          }
          onChange={(e) => {
            setDayStatusTitle(e.target.value)
            setNotice(null)
          }}
        />
      </label>

      <fieldset className="detail-cal-admin-field">
        <legend>對象</legend>
        <div className="detail-cal-admin-audience">
          {(
            [
              ['all', '全部教師'],
              ['grades', '指定級別'],
              ['teachers', '指定教師'],
            ] as const satisfies readonly [AudienceMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className="detail-cal-admin-audience-opt">
              <input
                type="radio"
                name="cal-day-status-audience"
                checked={audienceMode === mode}
                onChange={() => setAudienceMode(mode)}
              />
              {label}
            </label>
          ))}
        </div>
        {audienceMode === 'grades' && (
          <>
            <p className="detail-cal-admin-lead">
              會推送給任教該級別的老師（不限右上角科目篩選）。
            </p>
            <div className="detail-cal-admin-chips">
            {GRADE_LEVELS.map((g) => {
              const on = grades.has(g)
              return (
                <button
                  key={g}
                  type="button"
                  className={`detail-cal-admin-chip${on ? ' active' : ''}`}
                  onClick={() => {
                    setGrades((prev) => {
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
          </>
        )}
        {audienceMode === 'teachers' && (
          <div className="detail-cal-admin-chips">
            {teachers.map((t) => {
              const on = teacherIds.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`detail-cal-admin-chip${on ? ' active' : ''}`}
                  onClick={() => {
                    setTeacherIds((prev) => {
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

      {notice && (
        <p className="detail-cal-admin-notice" role="status">
          {notice}
        </p>
      )}

      <button
        type="button"
        className="detail-cal-admin-apply"
        disabled={count === 0}
        onClick={apply}
      >
        套用至已選日期
      </button>
    </div>
  )
}
