import type { MutableRefObject, MouseEvent } from 'react'
import { EVENT_KIND_META, isColourOnlyDayStatus } from '../../data/calendarEvents'
import type { CalendarEvent, CalendarEventKind } from '../../types'
import { clipboardLabel, type EventClipboard } from './calendarClipboard'
import { EventMark } from './EventMark'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const LEGEND_KINDS: CalendarEventKind[] = [
  'holiday',
  'non-school-day',
  'school-day',
  'timetable',
  'event',
  'progress',
  'department',
  'assessment',
]

export type CalendarCell = {
  day: number
  inMonth: boolean
  iso: string
}

type Props = {
  year: number
  monthIndex: number
  monthEventCount: number
  cells: CalendarCell[]
  byDate: Map<string, CalendarEvent[]>
  todayIso: string
  selectedIso: string
  selectedDates: Set<string>
  selectedEventIds: Set<string>
  hoverIso: string | null
  pinned: boolean
  isAdmin: boolean
  isDragging: boolean
  clipboard: EventClipboard[] | null
  pasteNotice: string | null
  hoveringDayRef: MutableRefObject<boolean>
  onGoPrev: () => void
  onGoNext: () => void
  onGoToday: () => void
  onAdminDayMouseDown: (
    iso: string,
    e: MouseEvent<HTMLButtonElement>,
  ) => void
  onAdminDayMouseEnter: (iso: string) => void
  onAdminDayMouseUp: (iso: string) => void
  onPreviewDay: (iso: string) => void
  onLockDay: (iso: string) => void
  onEventChipClick: (event: CalendarEvent, e: MouseEvent) => void
  setHoverIso: (iso: string | null) => void
}

export function CalendarMonthGrid({
  year,
  monthIndex,
  monthEventCount,
  cells,
  byDate,
  todayIso,
  selectedIso,
  selectedDates,
  selectedEventIds,
  hoverIso,
  pinned,
  isAdmin,
  isDragging,
  clipboard,
  pasteNotice,
  hoveringDayRef,
  onGoPrev,
  onGoNext,
  onGoToday,
  onAdminDayMouseDown,
  onAdminDayMouseEnter,
  onAdminDayMouseUp,
  onPreviewDay,
  onLockDay,
  onEventChipClick,
  setHoverIso,
}: Props) {
  return (
    <>
      <div className="detail-cal-toolbar">
        <div className="detail-cal-nav">
          <button
            type="button"
            className="detail-cal-nav-btn"
            aria-label="上一個月"
            onClick={onGoPrev}
          >
            ‹
          </button>
          <h2 className="detail-cal-month">
            {year}年{monthIndex + 1}月
          </h2>
          <button
            type="button"
            className="detail-cal-nav-btn"
            aria-label="下一個月"
            onClick={onGoNext}
          >
            ›
          </button>
        </div>
        <div className="detail-cal-toolbar-meta">
          <span className="detail-cal-count">{monthEventCount} 項事件</span>
          {clipboard && clipboard.length > 0 && (
            <span className="detail-cal-paste-hint" role="status">
              已複製「{clipboardLabel(clipboard)}」— 點選日期後按 ⌘V／Ctrl+V
            </span>
          )}
          {selectedEventIds.size > 0 && !clipboard?.length && (
            <span className="detail-cal-paste-hint" role="status">
              已選 {selectedEventIds.size} 項 — 按 ⌘C／Ctrl+C 複製
            </span>
          )}
          {pasteNotice && (
            <span className="detail-cal-paste-notice" role="status">
              {pasteNotice}
            </span>
          )}
          <button
            type="button"
            className="detail-cal-today-btn"
            onClick={onGoToday}
          >
            今天
          </button>
        </div>
      </div>

      <div
        className="detail-cal-grid"
        role="grid"
        aria-label={`${year}年${monthIndex + 1}月，可用方向鍵瀏覽日期`}
        tabIndex={0}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="detail-cal-weekday" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.iso) ?? []
          const chipEvents = dayEvents.filter(
            (event) => !isColourOnlyDayStatus(event),
          )
          const hasHoliday = dayEvents.some((e) => e.kind === 'holiday')
          const hasNonSchoolDay =
            !hasHoliday &&
            dayEvents.some((e) => e.kind === 'non-school-day')
          const hasTimetable = dayEvents.some((e) => e.kind === 'timetable')
          const isToday = cell.iso === todayIso
          const isSelected = cell.iso === selectedIso
          const isMultiSelected =
            isAdmin && selectedDates.has(cell.iso) && selectedDates.size > 1
          const isInSelection = isAdmin && selectedDates.has(cell.iso)
          const isHovering = hoverIso === cell.iso
          const numClass = [
            'detail-cal-day-num',
            hasHoliday && cell.inMonth ? 'holiday' : '',
            hasNonSchoolDay && cell.inMonth ? 'non-school-day' : '',
            hasTimetable && cell.inMonth ? 'timetable' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={cell.iso + String(cell.inMonth)}
              type="button"
              role="gridcell"
              className={[
                'detail-cal-day',
                cell.inMonth ? '' : 'out',
                hasHoliday && cell.inMonth ? 'holiday' : '',
                hasNonSchoolDay && cell.inMonth ? 'non-school-day' : '',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
                isInSelection ? 'in-selection' : '',
                isMultiSelected ? 'multi-selected' : '',
                pinned && isSelected && !isAdmin ? 'locked' : '',
                pinned && isHovering && !isSelected ? 'hovering' : '',
                isDragging ? 'dragging' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-selected={isSelected || isInSelection}
              aria-pressed={pinned && isSelected && !isAdmin}
              onMouseDown={(e) => onAdminDayMouseDown(cell.iso, e)}
              onMouseEnter={() => {
                hoveringDayRef.current = true
                setHoverIso(cell.iso)
                onAdminDayMouseEnter(cell.iso)
                onPreviewDay(cell.iso)
              }}
              onMouseUp={() => onAdminDayMouseUp(cell.iso)}
              onMouseLeave={() => {
                hoveringDayRef.current = false
                setHoverIso(null)
              }}
              onFocus={() => onPreviewDay(cell.iso)}
              onClick={() => onLockDay(cell.iso)}
            >
              <span className={numClass}>{cell.day}</span>
              {cell.inMonth && chipEvents.length > 0 && (
                <ul className="detail-cal-day-events">
                  {chipEvents.slice(0, 3).map((event) => {
                    const chipSelected = selectedEventIds.has(event.id)
                    const label =
                      event.title.trim() ||
                      (event.lesson
                        ? event.lesson.subject
                        : '（無標題）')
                    return (
                      <li
                        key={event.id}
                        className={[
                          'detail-cal-chip',
                          event.kind === 'holiday' ? 'holiday' : '',
                          'selectable',
                          chipSelected ? 'selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={`${label}（點選；⌘／Ctrl+點擊多選）`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => onEventChipClick(event, e)}
                      >
                        <EventMark kind={event.kind} />
                        <span className="detail-cal-chip-title">
                          {label}
                        </span>
                      </li>
                    )
                  })}
                  {chipEvents.length > 3 && (
                    <li className="detail-cal-more">
                      +{chipEvents.length - 3}
                    </li>
                  )}
                </ul>
              )}
            </button>
          )
        })}
      </div>

      <ul className="detail-cal-legend">
        {LEGEND_KINDS.map((kind) => {
          const meta = EVENT_KIND_META[kind]
          return (
            <li key={kind}>
              <EventMark kind={kind} />
              <span>{meta.label}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
