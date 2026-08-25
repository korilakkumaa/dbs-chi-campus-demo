import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { formatEventDateLabel, dayStatusCustomNote } from '../../data/calendarEvents'
import {
  getDayTimetable,
  lessonHighlight,
  weekdayLabel,
  type DayPeriod,
  type SchoolWeekday,
} from '../../data/teacherTimetable'
import type { CalendarEvent } from '../../types'

/** Payload when a timetable slot is clicked (lesson, break, or free). */
export type LessonPick = {
  subject: string
  group: string
  room: string
  start: string
  end: string
  /** True when the pick spans a linked 連堂 range. */
  linked?: boolean
}

type Props = {
  iso: string
  teacherId: string | null
  teacherName: string
  events: CalendarEvent[]
  locked: boolean
  onLessonClick?: (lesson: LessonPick) => void
}

type LessonPeriod = Extract<DayPeriod, { type: 'lesson' }>

const MERGES_KEY = 'campus-tt-merges-v1'

function loadMerges(teacherId: string, weekday: SchoolWeekday): string[][] {
  try {
    const raw = localStorage.getItem(MERGES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, string[][]>
    const list = parsed[`${teacherId}|${weekday}`]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveMerges(
  teacherId: string,
  weekday: SchoolWeekday,
  groups: string[][],
) {
  try {
    const raw = localStorage.getItem(MERGES_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[][]>) : {}
    parsed[`${teacherId}|${weekday}`] = groups
    localStorage.setItem(MERGES_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

function isLesson(period: DayPeriod): period is LessonPeriod {
  return period.type === 'lesson'
}

function lessonsCompatible(a: LessonPeriod, b: LessonPeriod) {
  return (
    a.subject === b.subject && a.group === b.group && a.room === b.room
  )
}

function normalizeRange(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a]
}

function rangeIsLinkable(periods: DayPeriod[], from: number, to: number) {
  if (to - from < 1) return false
  const first = periods[from]
  if (!isLesson(first)) return false
  for (let i = from; i <= to; i++) {
    const p = periods[i]
    if (!isLesson(p) || !lessonsCompatible(first, p)) return false
    if (i > from) {
      const prev = periods[i - 1]
      if (!isLesson(prev) || prev.end !== p.start) return false
    }
  }
  return true
}

/** Map each period index in a 連堂 group to the shared span start/end. */
function linkedSpanByIndex(
  periods: DayPeriod[],
  mergeGroups: string[][],
): Map<number, { start: string; end: string; starts: string[] }> {
  const byStart = new Map<string, number>()
  periods.forEach((p, i) => {
    if (isLesson(p)) byStart.set(p.start, i)
  })

  const map = new Map<number, { start: string; end: string; starts: string[] }>()
  for (const group of mergeGroups) {
    const idxs = group
      .map((start) => byStart.get(start))
      .filter((i): i is number => i != null)
      .sort((a, b) => a - b)
    if (idxs.length < 2) continue
    const from = idxs[0]
    const to = idxs[idxs.length - 1]
    if (!rangeIsLinkable(periods, from, to)) continue
    let contiguous = true
    for (let i = 1; i < idxs.length; i++) {
      if (idxs[i] !== idxs[i - 1] + 1) {
        contiguous = false
        break
      }
    }
    if (!contiguous) continue
    const first = periods[from]
    const last = periods[to]
    if (!isLesson(first) || !isLesson(last)) continue
    const starts = idxs.map((i) => (periods[i] as LessonPeriod).start)
    const span = { start: first.start, end: last.end, starts }
    for (const i of idxs) map.set(i, span)
  }
  return map
}

function pickFromPeriod(
  period: DayPeriod,
  span?: { start: string; end: string },
): LessonPick {
  const start = span?.start ?? period.start
  const end = span?.end ?? period.end
  const linked = Boolean(span)

  if (period.type === 'lesson') {
    return {
      subject: period.subject,
      group: period.group,
      room: period.room,
      start,
      end,
      linked,
    }
  }
  if (period.type === 'break') {
    return {
      subject: period.label ?? '小息',
      group: '',
      room: '',
      start,
      end,
    }
  }
  return {
    subject: '空堂',
    group: '',
    room: '',
    start,
    end,
  }
}

function formatYearMonth(iso: string) {
  const [y, m] = iso.split('-')
  return `${y}年${Number(m)}月`
}

function TimeColumn({
  start,
  end,
  linked,
}: {
  start: string
  end: string
  linked?: boolean
}) {
  return (
    <span className={`day-tt-time${linked ? ' is-linked' : ''}`}>
      <span className="day-tt-time-start">{start}</span>
      <span className="day-tt-time-end">{end}</span>
      {linked ? <span className="day-tt-linked-mark">連堂</span> : null}
    </span>
  )
}

function PeriodRow({
  period,
  displayStart,
  displayEnd,
  linked,
  linkedEdge,
  selected,
  onPointerDown,
  onPointerEnter,
  onUnlink,
}: {
  period: DayPeriod
  displayStart: string
  displayEnd: string
  linked: boolean
  linkedEdge?: 'first' | 'mid' | 'last'
  selected: boolean
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerEnter: () => void
  onUnlink?: () => void
}) {
  const breakLabel =
    period.type === 'break' ? (period.label ?? '小息') : null
  const lunchGap =
    period.type === 'break' && breakLabel === '午膳' ? ' lunch-gap' : ''

  if (period.type === 'break') {
    return (
      <li
        className={`day-tt-row break interactive quiet${lunchGap}${selected ? ' selecting' : ''}`}
        data-label={breakLabel ?? undefined}
        onPointerEnter={onPointerEnter}
      >
        <button
          type="button"
          className="day-tt-slot-hit compact"
          onPointerDown={onPointerDown}
          aria-label={`${breakLabel} ${displayStart}–${displayEnd}`}
        >
          <TimeColumn start={displayStart} end={displayEnd} />
          <span className="day-tt-body">
            <span className="day-tt-break-label">{breakLabel}</span>
          </span>
        </button>
      </li>
    )
  }

  if (period.type === 'free') {
    return (
      <li
        className={`day-tt-row free interactive quiet${selected ? ' selecting' : ''}`}
        onPointerEnter={onPointerEnter}
      >
        <button
          type="button"
          className="day-tt-slot-hit compact"
          onPointerDown={onPointerDown}
          aria-label={`空堂 ${displayStart}–${displayEnd}`}
        >
          <TimeColumn start={displayStart} end={displayEnd} />
          <span className="day-tt-body">
            <span className="day-tt-free-label">空堂</span>
          </span>
        </button>
      </li>
    )
  }

  const tone = lessonHighlight(period.group, period.subject)
  const edgeClass = linked && linkedEdge ? ` linked-${linkedEdge}` : ''
  return (
    <li
      className={`day-tt-row lesson${linked ? ' linked' : ''}${edgeClass}${selected ? ' selecting' : ''}`}
      style={
        {
          '--tt-accent': tone.accent,
          '--tt-soft': tone.soft,
          '--tt-text': tone.text,
        } as CSSProperties
      }
      onPointerEnter={onPointerEnter}
    >
      <button
        type="button"
        className="day-tt-lesson-hit"
        onPointerDown={onPointerDown}
        aria-label={
          linked
            ? `連堂 ${period.subject} ${period.group} ${displayStart}–${displayEnd}`
            : `課堂 ${period.subject} ${period.group}`
        }
      >
        <TimeColumn start={displayStart} end={displayEnd} linked={linked} />
        <span className="day-tt-body">
          <span className="day-tt-line">
            <span className="day-tt-subject">{period.subject}</span>
          </span>
          <span className="day-tt-line meta">
            <span className="day-tt-group">{period.group}</span>
            <span className="day-tt-room">{period.room}</span>
            {linked && onUnlink && linkedEdge === 'first' && (
              <span
                className="day-tt-unlink"
                role="button"
                tabIndex={0}
                title="取消連堂"
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onUnlink()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onUnlink()
                  }
                }}
              >
                取消
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export function DayTimetablePanel({
  iso,
  teacherId,
  teacherName,
  events,
  locked,
  onLessonClick,
}: Props) {
  const result = getDayTimetable(teacherId, iso, events)
  const weekday = result.status === 'ok' ? result.weekday : null
  const periods = result.status === 'ok' ? result.periods : []

  const [mergeGroups, setMergeGroups] = useState<string[][]>([])
  const [selectRange, setSelectRange] = useState<[number, number] | null>(null)
  const dragRef = useRef<{
    origin: number
    current: number
    moved: boolean
    pointerId: number
  } | null>(null)

  useEffect(() => {
    if (!teacherId || weekday == null) {
      setMergeGroups([])
      return
    }
    setMergeGroups(loadMerges(teacherId, weekday))
  }, [teacherId, weekday, iso])

  const persistMerges = (next: string[][]) => {
    setMergeGroups(next)
    if (teacherId && weekday != null) saveMerges(teacherId, weekday, next)
  }

  const spans = linkedSpanByIndex(periods, mergeGroups)

  const indexInSelect = (index: number) => {
    if (!selectRange) return false
    const [a, b] = selectRange
    return index >= a && index <= b
  }

  const finishDrag = (endIdx: number) => {
    const drag = dragRef.current
    dragRef.current = null
    setSelectRange(null)
    if (!drag) return

    const [from, to] = normalizeRange(drag.origin, endIdx)

    if (!drag.moved || from === to) {
      const period = periods[drag.origin]
      if (!period) return
      onLessonClick?.(pickFromPeriod(period, spans.get(drag.origin)))
      return
    }

    if (!rangeIsLinkable(periods, from, to)) return

    const starts: string[] = []
    for (let i = from; i <= to; i++) {
      const p = periods[i]
      if (isLesson(p)) starts.push(p.start)
    }

    const next = mergeGroups.filter((group) => {
      return !group.some((s) => starts.includes(s))
    })
    next.push(starts)
    persistMerges(next)

    const first = periods[from]
    const last = periods[to]
    if (isLesson(first) && isLesson(last)) {
      onLessonClick?.({
        subject: first.subject,
        group: first.group,
        room: first.room,
        start: first.start,
        end: last.end,
        linked: true,
      })
    }
  }

  const finishDragRef = useRef(finishDrag)
  finishDragRef.current = finishDrag

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      finishDragRef.current(drag.current)
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const startDrag = (index: number, e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = {
      origin: index,
      current: index,
      moved: false,
      pointerId: e.pointerId,
    }
    setSelectRange([index, index])
  }

  const extendDrag = (index: number) => {
    const drag = dragRef.current
    if (!drag) return
    if (index !== drag.origin) drag.moved = true
    drag.current = index
    setSelectRange(normalizeRange(drag.origin, index))
  }

  const unlinkGroup = (starts: string[]) => {
    persistMerges(
      mergeGroups.filter((g) => g.join('|') !== starts.join('|')),
    )
  }

  return (
    <div className={`day-tt${locked ? ' locked' : ''}`}>
      <header className="day-tt-head">
        <div className="day-tt-head-row">
          <p className="day-tt-kicker">{teacherName}</p>
          {locked && (
            <span className="day-tt-pinned" title="再點該日或按 Esc 解除鎖定">
              已鎖定
            </span>
          )}
        </div>
        <h2 className="day-tt-date">{formatEventDateLabel(iso)}</h2>
      </header>

      {result.status === 'no-timetable' && (
        <p className="day-tt-note">尚未匯入此教師的時間表。</p>
      )}

      {result.status === 'out-of-year' && (
        <p className="day-tt-note">
          此時間表屬{result.academicYear.label}學年（
          {formatYearMonth(result.academicYear.validFrom)}至
          {formatYearMonth(result.academicYear.validTo)}
          ），所選日期不在有效期內。
        </p>
      )}

      {result.status === 'non-school-day' && (
        <div className="day-tt-holiday day-tt-non-school">
          <p className="day-tt-holiday-label">非正常上課日</p>
          {result.title ? (
            <p className="day-tt-holiday-title">{result.title}</p>
          ) : null}
        </div>
      )}

      {result.status === 'weekend' && (
        <p className="day-tt-note">週末無需上課。</p>
      )}

      {result.status === 'holiday' && (
        <div className="day-tt-holiday">
          <p className="day-tt-holiday-label">假期</p>
          {result.title ? (
            <p className="day-tt-holiday-title">{result.title}</p>
          ) : null}
        </div>
      )}

      {result.status === 'ok' && (
        <>
          <p className="day-tt-weekline">
            {weekdayLabel(result.weekday)}時間表
            <span className="day-tt-year"> · {result.academicYear.label}</span>
            {result.adoptedFrom != null && (
              <span className="day-tt-adopt">
                （原{weekdayLabel(result.adoptedFrom)}，按調課日）
              </span>
            )}
          </p>
          <ul
            className="day-tt-list"
            title="拖選相連課節可顯示連堂時間"
          >
            {periods.map((period, index) => {
              const span = spans.get(index)
              let linkedEdge: 'first' | 'mid' | 'last' | undefined
              if (span) {
                const pos = span.starts.indexOf(
                  isLesson(period) ? period.start : '',
                )
                if (pos === 0) linkedEdge = 'first'
                else if (pos === span.starts.length - 1) linkedEdge = 'last'
                else if (pos > 0) linkedEdge = 'mid'
              }
              return (
                <PeriodRow
                  key={`${period.type}-${period.start}-${period.end}`}
                  period={period}
                  displayStart={span?.start ?? period.start}
                  displayEnd={span?.end ?? period.end}
                  linked={Boolean(span)}
                  linkedEdge={linkedEdge}
                  selected={indexInSelect(index)}
                  onPointerDown={(e) => startDrag(index, e)}
                  onPointerEnter={() => extendDrag(index)}
                  onUnlink={
                    span ? () => unlinkGroup(span.starts) : undefined
                  }
                />
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
