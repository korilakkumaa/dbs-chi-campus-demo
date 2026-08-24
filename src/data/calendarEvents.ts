import type { CalendarEvent, CalendarEventKind } from '../types'
import { academicYearStartFromIso, isoInAcademicYear } from './academicYear'
import { buildSchoolCalendar2526Rows } from './schoolCalendar2526'
import {
  buildSchoolCalendar2627Rows,
  type SchoolCalendarRow,
} from './schoolCalendar2627'

/** Bump when seed calendar changes so stale localStorage does not hide updates. */
export const CALENDAR_EVENTS_KEY = 'campus-calendar-events-v8'

export const SCHOOL_CALENDAR_YEAR_KEY = 'campus-calendar-school-year-v1'

export const EVENT_KIND_META: Record<
  CalendarEventKind,
  { label: string; color: string; mode: 'text' | 'dot' | 'circle' }
> = {
  holiday: { label: '學校／公共假期', color: '#c45a3a', mode: 'text' },
  'non-school-day': { label: '非正常上課日', color: '#8a6a4a', mode: 'text' },
  'school-day': { label: '正常上課日', color: '#2a6b52', mode: 'circle' },
  event: { label: '校曆活動', color: '#6b4c3b', mode: 'dot' },
  timetable: { label: '調課日', color: '#c45a3a', mode: 'circle' },
  progress: { label: '進度表任務', color: '#c4a035', mode: 'dot' },
  department: { label: '科組活動', color: '#355447', mode: 'dot' },
  assessment: { label: '科組測考', color: '#5f8496', mode: 'dot' },
}

/** Academic years with built-in school calendar seed data (newest first). */
export const SCHOOL_CALENDAR_YEARS = [2026, 2025] as const

export type SchoolCalendarYear = (typeof SCHOOL_CALENDAR_YEARS)[number]

const SEED_BUILDERS: Record<
  SchoolCalendarYear,
  () => SchoolCalendarRow[]
> = {
  2025: buildSchoolCalendar2526Rows,
  2026: buildSchoolCalendar2627Rows,
}

function rowsToSeedEvents(
  rows: SchoolCalendarRow[],
  schoolYearStart: SchoolCalendarYear,
): CalendarEvent[] {
  const prefix = `ce-${schoolYearStart}-${String(schoolYearStart + 1).slice(-2)}`
  return rows.map((row, index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    date: row.date,
    title: row.title,
    kind: row.kind,
    schoolYearStart,
    createdBy: 'u-admin',
    audience: { type: 'all' as const },
  }))
}

export function buildSeedCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const year of SCHOOL_CALENDAR_YEARS) {
    events.push(...rowsToSeedEvents(SEED_BUILDERS[year](), year))
  }
  return events
}

export const seedCalendarEvents: CalendarEvent[] = buildSeedCalendarEvents()

export function resolveEventSchoolYearStart(event: CalendarEvent): number {
  if (event.schoolYearStart != null) return event.schoolYearStart
  return academicYearStartFromIso(event.date)
}

export function eventInSchoolYear(
  event: CalendarEvent,
  schoolYearStart: number,
): boolean {
  return isoInAcademicYear(event.date, schoolYearStart)
}

export function filterEventsBySchoolYear(
  events: CalendarEvent[],
  schoolYearStart: number,
): CalendarEvent[] {
  return events.filter((e) => eventInSchoolYear(e, schoolYearStart))
}

export function newCalendarEventId(): string {
  return `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Inclusive YYYY-MM-DD range → list of dates. */
export function expandIsoDateRange(from: string, to: string): string[] {
  if (!from) return []
  const end = to && to >= from ? to : from
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cursor = new Date(fy, fm - 1, fd)
  const last = new Date(ey, em - 1, ed)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return []
  const out: string[] = []
  while (cursor <= last) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'] as const

/** Format YYYY-MM-DD as `15/8（六）`. */
export function formatEventDateLabel(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return iso
  return `${d}/${m}（${WEEKDAY_SHORT[date.getDay()]}）`
}

/** Day-status markers shown compactly on the home mini calendar. */
export const CALENDAR_STATUS_KINDS = [
  'holiday',
  'non-school-day',
  'school-day',
] as const satisfies readonly CalendarEventKind[]

export type CalendarStatusKind = (typeof CALENDAR_STATUS_KINDS)[number]

export function isCalendarStatusKind(
  kind: CalendarEventKind,
): kind is CalendarStatusKind {
  return (CALENDAR_STATUS_KINDS as readonly CalendarEventKind[]).includes(kind)
}

/** Collapse same-month dates into `1日、7日、22–24日`. */
export function formatCompactMonthDates(isos: string[]): string {
  const days = [...new Set(isos)]
    .map((iso) => Number(iso.split('-')[2]))
    .filter((day) => !Number.isNaN(day))
    .sort((a, b) => a - b)

  if (days.length === 0) return ''

  const parts: string[] = []
  let rangeStart = days[0]
  let rangeEnd = days[0]

  for (let i = 1; i < days.length; i++) {
    if (days[i] === rangeEnd + 1) {
      rangeEnd = days[i]
      continue
    }
    parts.push(
      rangeStart === rangeEnd
        ? `${rangeStart}日`
        : `${rangeStart}–${rangeEnd}日`,
    )
    rangeStart = days[i]
    rangeEnd = days[i]
  }

  parts.push(
    rangeStart === rangeEnd
      ? `${rangeStart}日`
      : `${rangeStart}–${rangeEnd}日`,
  )
  return parts.join('、')
}

export function isoDateLocal(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Shift an ISO date by a number of calendar days. */
export function shiftIsoDays(iso: string, days: number): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return iso
  date.setDate(date.getDate() + days)
  return isoDateLocal(date)
}

/** ISO date of the Monday on or before `iso` (same week, Mon–Sun). */
export function mondayOfWeekIso(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return iso
  const dow = date.getDay()
  const delta = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + delta)
  return isoDateLocal(date)
}

/** Mon–Fri ISO dates for the school week starting on `mondayIso`. */
export function schoolWeekDates(mondayIso: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => shiftIsoDays(mondayIso, offset))
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function eventInMonth(event: CalendarEvent, year: number, monthIndex: number) {
  return event.date.startsWith(monthKey(year, monthIndex))
}
