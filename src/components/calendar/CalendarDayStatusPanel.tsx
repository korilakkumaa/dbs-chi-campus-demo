import { useState } from 'react'
import { EVENT_KIND_META } from '../../data/calendarEvents'
import { useCampus } from '../../context/CampusContext'
import type { CalendarAudience, CalendarEventKind } from '../../types'

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
  const [audienceMode, setAudienceMode] = useState<'all' | 'teachers'>('all')
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
    if (audienceMode === 'teachers' && teacherIds.size === 0) {
      setNotice('請至少選一位教師。')
      return
    }
    const title =
      dayStatusTitle.trim() ||
      (useCustomKind
        ? EVENT_KIND_META[customKind].label
        : DAY_STATUS_DEFAULT_TITLE[dayStatusKind])
    const audience: Exclude<CalendarAudience, { type: 'personal' }> =
      audienceMode === 'all'
        ? { type: 'all' }
        : { type: 'teachers', teacherIds: Array.from(teacherIds) }

    let total = 0
    for (const iso of sortedDates) {
      total += addCalendarEventsBatch({
        title,
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
        在月曆拖選或 Ctrl／⌘ 多選日期，再選擇類型並套用。
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
              : DAY_STATUS_DEFAULT_TITLE[dayStatusKind]
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
              ['teachers', '指定教師'],
            ] as const
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
