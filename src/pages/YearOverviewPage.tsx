import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { formatEventDateLabel } from '../data/calendarEvents'
import {
  academicYearMonths,
  academicYearDateRange,
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  isoInAcademicYear,
  listAcademicYearStarts,
} from '../data/academicYear'
import { useCampus } from '../context/CampusContext'
import type { CalendarEventKind } from '../types'

/** Calendar kinds shown on year overview (excludes day-status marks from detailed calendar). */
const OVERVIEW_KINDS: CalendarEventKind[] = [
  'timetable',
  'event',
  'department',
  'assessment',
]

const DONE_KEY = 'campus-year-overview-done-v1'
const CUSTOM_KEY = 'campus-year-overview-custom-v1'
const FLIP_MS = 320

type OverviewItem = {
  id: string
  date: string
  title: string
  custom?: boolean
}

type CustomEntry = {
  id: string
  monthKey: string
  date: string
  title: string
}

function loadDoneIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

function saveDoneIds(ids: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

function loadCustomEntries(): CustomEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomEntries(entries: CustomEntry[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

function newCustomId() {
  return `yo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function parseStartYearParam(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null
  return Math.trunc(n)
}

function formatYm(isoDay: string) {
  const [y, m] = isoDay.split('-')
  return `${y}年${Number(m)}月`
}

function sortItems(
  items: OverviewItem[],
  doneIds: Set<string>,
): OverviewItem[] {
  return items.slice().sort((a, b) => {
    const da = doneIds.has(a.id) ? 1 : 0
    const db = doneIds.has(b.id) ? 1 : 0
    if (da !== db) return da - db
    return (
      a.date.localeCompare(b.date) ||
      a.title.localeCompare(b.title, 'zh-Hant')
    )
  })
}

/** FLIP reorder so checked items slide instead of jumping. */
function FlipList({
  flipKey,
  children,
}: {
  flipKey: string
  children: ReactNode
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const prevRects = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const nodes = [
      ...list.querySelectorAll<HTMLElement>('[data-flip-id]'),
    ]
    const nextRects = new Map<string, DOMRect>()
    for (const node of nodes) {
      const id = node.dataset.flipId
      if (!id) continue
      nextRects.set(id, node.getBoundingClientRect())
    }

    if (prevRects.current.size === 0) {
      prevRects.current = nextRects
      return
    }

    for (const node of nodes) {
      const id = node.dataset.flipId
      if (!id) continue
      const prev = prevRects.current.get(id)
      const next = nextRects.get(id)
      if (!prev || !next) continue
      const dy = prev.top - next.top
      if (Math.abs(dy) < 0.5) continue

      node.style.transition = 'none'
      node.style.transform = `translateY(${dy}px)`
      void node.offsetHeight
      node.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      node.style.transform = 'translateY(0)'
    }

    prevRects.current = nextRects

    const clear = window.setTimeout(() => {
      for (const node of nodes) {
        node.style.transition = ''
        node.style.transform = ''
      }
    }, FLIP_MS + 40)
    return () => window.clearTimeout(clear)
  }, [flipKey])

  return (
    <ul className="year-ov-list" ref={listRef}>
      {children}
    </ul>
  )
}

function MonthAddRow({
  monthKey,
  year,
  monthIndex,
  onAdd,
}: {
  monthKey: string
  year: number
  monthIndex: number
  onAdd: (entry: CustomEntry) => void
}) {
  const maxDay = daysInMonth(year, monthIndex)
  const [day, setDay] = useState('')
  const [title, setTitle] = useState('')

  const commit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    let d = Number(day)
    if (!Number.isFinite(d) || d < 1) d = 1
    if (d > maxDay) d = maxDay
    const date = `${monthKey}-${String(d).padStart(2, '0')}`
    onAdd({
      id: newCustomId(),
      monthKey,
      date,
      title: trimmed,
    })
    setTitle('')
    setDay('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="year-ov-add">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="year-ov-add-day"
        value={day}
        placeholder="Day"
        maxLength={2}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDay(next)
        }}
        onKeyDown={onKeyDown}
        aria-label="日期"
      />
      <input
        type="text"
        className="year-ov-add-title"
        value={title}
        placeholder="新增項目…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        aria-label="新增項目"
      />
    </div>
  )
}

export function YearOverviewPage() {
  const { calendarEvents } = useCampus()
  const [searchParams, setSearchParams] = useSearchParams()
  const [doneIds, setDoneIds] = useState<Set<string>>(() => loadDoneIds())
  const [customEntries, setCustomEntries] = useState<CustomEntry[]>(() =>
    loadCustomEntries(),
  )

  const yearOptions = useMemo(() => listAcademicYearStarts(), [])
  const defaultStart = useMemo(() => defaultAcademicYearStart(), [])

  const startYear = useMemo(() => {
    const param = parseStartYearParam(searchParams.get('year'))
    if (param != null && yearOptions.includes(param)) return param
    return defaultStart
  }, [searchParams, yearOptions, defaultStart])

  const months = useMemo(() => academicYearMonths(startYear), [startYear])
  const range = useMemo(() => academicYearDateRange(startYear), [startYear])

  useEffect(() => {
    saveDoneIds(doneIds)
  }, [doneIds])

  useEffect(() => {
    saveCustomEntries(customEntries)
  }, [customEntries])

  const byMonth = useMemo(() => {
    const map = new Map<string, OverviewItem[]>()

    for (const e of calendarEvents) {
      if (!isoInAcademicYear(e.date, startYear)) continue
      if (!OVERVIEW_KINDS.includes(e.kind)) continue
      const key = e.date.slice(0, 7)
      const list = map.get(key) ?? []
      list.push({
        id: e.id,
        date: e.date,
        title: e.title,
      })
      map.set(key, list)
    }

    for (const c of customEntries) {
      if (!isoInAcademicYear(c.date, startYear)) continue
      const list = map.get(c.monthKey) ?? []
      list.push({
        id: c.id,
        date: c.date,
        title: c.title,
        custom: true,
      })
      map.set(c.monthKey, list)
    }

    for (const [key, list] of map) {
      map.set(key, sortItems(list, doneIds))
    }
    return map
  }, [calendarEvents, customEntries, startYear, doneIds])

  const onSelectYear = (next: number) => {
    if (next === defaultStart) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ year: String(next) }, { replace: true })
    }
  }

  const toggleDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addCustom = (entry: CustomEntry) => {
    setCustomEntries((prev) => [...prev, entry])
  }

  const removeCustom = (id: string) => {
    setCustomEntries((prev) => prev.filter((e) => e.id !== id))
    setDoneIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const doneSig = useMemo(
    () => [...doneIds].sort().join(','),
    [doneIds],
  )

  return (
    <div className="page year-overview-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>全年概覽</h1>
          <p>
            {formatAcademicYearLabel(startYear)}學年（
            {formatYm(range.from)}至{formatYm(range.to)}
            ）校曆活動一覽；可自行新增項目，勾選後會劃去並移到該月最底。上課日／假期標注請見詳細日曆。
          </p>
        </div>
        <label className="year-ov-select-wrap">
          <span className="year-ov-select-label">學年</span>
          <select
            className="year-ov-select"
            value={startYear}
            onChange={(e) => onSelectYear(Number(e.target.value))}
            aria-label="選擇學年"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {formatAcademicYearLabel(y)}
                {y === defaultStart ? '（目前）' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="year-ov-grid reveal-up delay-1">
        {months.map(({ year, monthIndex, label }) => {
          const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
          const items = byMonth.get(key) ?? []
          const detailLink = `/calendar?date=${key}-01`
          const orderSig = items.map((e) => e.id).join('|')
          return (
            <GlassPanel key={key} className="year-ov-month">
              <div className="year-ov-month-head">
                <h2 className="year-ov-month-title">
                  {label}
                  <span className="year-ov-month-year">{year}</span>
                </h2>
                <Link className="year-ov-month-link" to={detailLink}>
                  詳細日曆
                </Link>
              </div>
              {items.length > 0 ? (
                <FlipList flipKey={`${key}:${orderSig}:${doneSig}`}>
                  {items.map((item) => {
                    const done = doneIds.has(item.id)
                    return (
                      <li
                        key={item.id}
                        data-flip-id={item.id}
                        className={`year-ov-item${done ? ' done' : ''}`}
                      >
                        <label className="year-ov-check">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleDone(item.id)}
                            aria-label={
                              done
                                ? `取消完成：${item.title}`
                                : `標記完成：${item.title}`
                            }
                          />
                          <span className="year-ov-check-box" aria-hidden>
                            <svg
                              viewBox="0 0 24 24"
                              className="year-ov-check-icon"
                            >
                              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          </span>
                        </label>
                        <span className="year-ov-item-date">
                          {formatEventDateLabel(item.date)}
                        </span>
                        <span className="year-ov-item-title">
                          {item.title}
                        </span>
                        {item.custom && (
                          <button
                            type="button"
                            className="year-ov-item-remove"
                            aria-label={`刪除 ${item.title}`}
                            onClick={() => removeCustom(item.id)}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    )
                  })}
                </FlipList>
              ) : (
                <p className="year-ov-empty">尚未有項目</p>
              )}
              <MonthAddRow
                monthKey={key}
                year={year}
                monthIndex={monthIndex}
                onAdd={addCustom}
              />
            </GlassPanel>
          )
        })}
      </div>
    </div>
  )
}
