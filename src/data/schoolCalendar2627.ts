import type { CalendarEventKind } from '../types'
import schoolCalendar2627Csv from './school-calendar-2627-events.csv?raw'

/**
 * DBS 2026/27 school calendar — from official full events table.
 * Period: 2026-09-01 – 2027-08-31 · 190 school days.
 */
export type SchoolCalendarRow = {
  date: string
  title: string
  kind: CalendarEventKind
}

type CsvEvent = {
  date: string
  dayOfWeek: string
  event: string
  category: string
  notes: string
  isHoliday: boolean
}

/** Fill unnamed days inside official holiday blocks (CSV only lists named / start days). */
const HOLIDAY_FILL_RANGES: {
  from: string
  to: string
  title: string
}[] = [
  {
    from: '2026-12-21',
    to: '2027-01-03',
    title: 'Christmas & New Year Holiday',
  },
  {
    from: '2027-02-02',
    to: '2027-02-10',
    title: 'Lunar New Year Holiday',
  },
  {
    from: '2027-03-26',
    to: '2027-03-31',
    title: 'Easter Holiday',
  },
  {
    from: '2027-04-01',
    to: '2027-04-05',
    title: 'Ching Ming Holiday',
  },
  {
    from: '2027-07-13',
    to: '2027-08-31',
    title: 'Summer Holiday',
  },
]

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function expandIsoDateRange(from: string, to: string): string[] {
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      continue
    }
    field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim())) rows.push(row)
  }
  return rows
}

function parseCsvEvents(text: string): CsvEvent[] {
  const table = parseCsv(text)
  if (table.length < 2) return []
  const header = table[0].map((h) => h.trim())
  const index = (name: string) => header.indexOf(name)
  const dateI = index('Date')
  const dayI = index('DayOfWeek')
  const eventI = index('Event')
  const catI = index('Category')
  const notesI = index('Notes')
  const holI = index('IsHoliday')
  return table.slice(1).flatMap((cols) => {
    const date = (cols[dateI] ?? '').trim()
    const event = (cols[eventI] ?? '').trim()
    if (!date || !event) return []
    return [
      {
        date,
        dayOfWeek: (cols[dayI] ?? '').trim(),
        event,
        category: (cols[catI] ?? '').trim(),
        notes: (cols[notesI] ?? '').trim(),
        isHoliday: (cols[holI] ?? '').trim().toLowerCase() === 'yes',
      },
    ]
  })
}

function titleCaseWeekday(value: string): string | null {
  const key = value.trim().toLowerCase()
  return WEEKDAY_NAMES.find((name) => name.toLowerCase() === key) ?? null
}

/** Timetable engine matches `adopts <Weekday> timetable`. */
function timetableTitle(row: CsvEvent): string {
  const note = row.notes.match(
    /(Monday|Tuesday|Wednesday|Thursday|Friday)\s*→\s*(Monday|Tuesday|Wednesday|Thursday|Friday)/i,
  )
  const adopted = row.event.match(
    /Adopt(?:s)?\s+(Monday|Tuesday|Wednesday|Thursday|Friday)/i,
  )
  const fromDay =
    titleCaseWeekday(note?.[1] ?? '') ?? titleCaseWeekday(row.dayOfWeek)
  const toDay =
    titleCaseWeekday(note?.[2] ?? '') ?? titleCaseWeekday(adopted?.[1] ?? '')
  if (fromDay && toDay) return `${fromDay} adopts ${toDay} timetable`
  return row.event
}

function kindFromCsv(row: CsvEvent): CalendarEventKind {
  const category = row.category.toLowerCase()
  const notes = row.notes.toLowerCase()
  if (row.isHoliday) return 'holiday'
  if (category.includes('timetable')) return 'timetable'
  if (
    category.includes('staff development') &&
    notes.includes('students no school')
  ) {
    return 'non-school-day'
  }
  if (/test|exam|sba|tsa|assessment/.test(category)) {
    return 'assessment'
  }
  return 'event'
}

function rowFromCsv(row: CsvEvent): SchoolCalendarRow {
  const kind = kindFromCsv(row)
  return {
    date: row.date,
    title: kind === 'timetable' ? timetableTitle(row) : row.event,
    kind,
  }
}

const KIND_ORDER: Record<CalendarEventKind, number> = {
  holiday: 0,
  'non-school-day': 1,
  'school-day': 2,
  timetable: 3,
  assessment: 4,
  event: 5,
  department: 6,
  progress: 7,
}

function sortRows(a: SchoolCalendarRow, b: SchoolCalendarRow): number {
  return (
    a.date.localeCompare(b.date) ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    a.title.localeCompare(b.title, 'en')
  )
}

/** Flat 2026/27 school-calendar rows (multiple events per date). */
export function buildSchoolCalendar2627Rows(): SchoolCalendarRow[] {
  const fromCsv = parseCsvEvents(schoolCalendar2627Csv).map(rowFromCsv)
  const holidayDates = new Set(
    fromCsv.filter((row) => row.kind === 'holiday').map((row) => row.date),
  )
  const fills: SchoolCalendarRow[] = []
  for (const range of HOLIDAY_FILL_RANGES) {
    for (const date of expandIsoDateRange(range.from, range.to)) {
      if (holidayDates.has(date)) continue
      holidayDates.add(date)
      fills.push({ date, title: range.title, kind: 'holiday' })
    }
  }
  return [...fromCsv, ...fills].sort(sortRows)
}

export const SCHOOL_YEAR_2627 = {
  label: '2026/27',
  validFrom: '2026-09-01',
  validTo: '2027-08-31',
  teachingUntil: '2027-07-12',
  totalSchoolDays: 190,
  staffDevelopmentDays: ['2026-09-04', '2026-11-10', '2027-05-12'] as const,
} as const
