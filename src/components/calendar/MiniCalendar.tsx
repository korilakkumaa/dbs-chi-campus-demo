import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EVENT_KIND_META,
  eventInMonth,
  isoDateLocal,
} from '../../data/calendarEvents'
import type { CalendarEvent, CalendarEventKind } from '../../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const DOT_KINDS: CalendarEventKind[] = [
  'event',
  'progress',
  'department',
  'assessment',
]

type Props = {
  year: number
  monthIndex: number
  events: CalendarEvent[]
  onMonthChange: (year: number, monthIndex: number) => void
}

export function MiniCalendar({
  year,
  monthIndex,
  events,
  onMonthChange,
}: Props) {
  const navigate = useNavigate()
  const todayIso = isoDateLocal()

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const prevDays = new Date(year, monthIndex, 0).getDate()
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7
    const list: {
      day: number
      inMonth: boolean
      iso: string
    }[] = []
    for (let i = 0; i < total; i++) {
      if (i < startPad) {
        const day = prevDays - startPad + i + 1
        const d = new Date(year, monthIndex - 1, day)
        list.push({
          day,
          inMonth: false,
          iso: isoDateLocal(d),
        })
      } else if (i < startPad + daysInMonth) {
        const day = i - startPad + 1
        const d = new Date(year, monthIndex, day)
        list.push({ day, inMonth: true, iso: isoDateLocal(d) })
      } else {
        const day = i - startPad - daysInMonth + 1
        const d = new Date(year, monthIndex + 1, day)
        list.push({ day, inMonth: false, iso: isoDateLocal(d) })
      }
    }
    return list
  }, [year, monthIndex])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (!eventInMonth(e, year, monthIndex) && !cells.some((c) => c.iso === e.date)) {
        continue
      }
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [events, year, monthIndex, cells])

  const goPrev = () => {
    if (monthIndex === 0) onMonthChange(year - 1, 11)
    else onMonthChange(year, monthIndex - 1)
  }

  const goNext = () => {
    if (monthIndex === 11) onMonthChange(year + 1, 0)
    else onMonthChange(year, monthIndex + 1)
  }

  const openCalendar = (iso?: string) => {
    navigate(iso ? `/calendar?date=${iso}` : '/calendar')
  }

  return (
    <div className="mini-cal">
      <div className="mini-cal-head">
        <button
          type="button"
          className="mini-cal-nav"
          aria-label="上一個月"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
        >
          ‹
        </button>
        <button
          type="button"
          className="mini-cal-title"
          onClick={() => openCalendar()}
        >
          {year}年{monthIndex + 1}月
        </button>
        <button
          type="button"
          className="mini-cal-nav"
          aria-label="下一個月"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
        >
          ›
        </button>
      </div>

      <div
        className="mini-cal-grid"
        role="grid"
        aria-label={`${year}年${monthIndex + 1}月`}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="mini-cal-weekday" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.iso) ?? []
          const hasHoliday = dayEvents.some((e) => e.kind === 'holiday')
          const hasTimetable = dayEvents.some((e) => e.kind === 'timetable')
          const dots = DOT_KINDS.filter((k) =>
            dayEvents.some((e) => e.kind === k),
          )
          const isToday = cell.iso === todayIso
          const numClass = [
            'mini-cal-day-num',
            hasHoliday && cell.inMonth ? 'holiday' : '',
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
                'mini-cal-day',
                cell.inMonth ? '' : 'out',
                hasHoliday && cell.inMonth ? 'holiday' : '',
                isToday ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => openCalendar(cell.iso)}
            >
              <span className={numClass}>{cell.day}</span>
              {cell.inMonth && dots.length > 0 && (
                <span className="mini-cal-dots" aria-hidden>
                  {dots.map((k) => (
                    <span
                      key={k}
                      className="mini-cal-dot"
                      style={{ background: EVENT_KIND_META[k].color }}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ul className="mini-cal-legend">
        <li>
          <span className="mini-cal-legend-swatch text" style={{ color: EVENT_KIND_META.holiday.color }}>
            15
          </span>
          假期
        </li>
        <li>
          <span
            className="mini-cal-legend-swatch circle"
            style={{ borderColor: EVENT_KIND_META.timetable.color }}
          >
            15
          </span>
          調課
        </li>
        <li>
          <span
            className="mini-cal-legend-swatch dot"
            style={{ background: EVENT_KIND_META.event.color }}
          />
          校曆
        </li>
        <li>
          <span
            className="mini-cal-legend-swatch dot"
            style={{ background: EVENT_KIND_META.progress.color }}
          />
          進度
        </li>
        <li>
          <span
            className="mini-cal-legend-swatch dot"
            style={{ background: EVENT_KIND_META.department.color }}
          />
          科組
        </li>
        <li>
          <span
            className="mini-cal-legend-swatch dot"
            style={{ background: EVENT_KIND_META.assessment.color }}
          />
          測考
        </li>
      </ul>
    </div>
  )
}
