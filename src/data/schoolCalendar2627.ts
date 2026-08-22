import type { CalendarEventKind } from '../types'

/**
 * DBS 2026/27 school calendar — derived from official school calendar (Aug 2026).
 * Period: 2026-09-01 – 2027-08-31 · 190 school days.
 */
export type SchoolCalendarRow = {
  date: string
  title: string
  kind: CalendarEventKind
}

/** Named days within a range override the range default title. */
type RangeRow = {
  from: string
  to: string
  title: string
  kind: CalendarEventKind
  named?: Record<string, string>
}

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

const SINGLE_ROWS: SchoolCalendarRow[] = [
  {
    date: '2026-09-04',
    title:
      'Beginning of School Year Staff Development Day and Commissioning Service',
    kind: 'non-school-day',
  },
  {
    date: '2026-09-15',
    title: 'Inter-House Swimming Finals',
    kind: 'event',
  },
  {
    date: '2026-09-26',
    title: 'The day following the Chinese Mid-Autumn Festival',
    kind: 'holiday',
  },
  { date: '2026-10-01', title: 'National Day', kind: 'holiday' },
  {
    date: '2026-10-07',
    title: 'Wednesday adopts Friday timetable',
    kind: 'timetable',
  },
  {
    date: '2026-10-09',
    title: 'Apple Race / G7 Character Building Programme (Day 2)',
    kind: 'event',
  },
  {
    date: '2026-10-19',
    title: 'The day following the Chinese Chung Yeung Festival',
    kind: 'holiday',
  },
  {
    date: '2026-11-09',
    title: 'The day following Garden Fete',
    kind: 'holiday',
  },
  {
    date: '2026-11-10',
    title: 'Staff Development Day',
    kind: 'non-school-day',
  },
  {
    date: '2026-11-12',
    title: 'Thursday adopts Tuesday timetable',
    kind: 'timetable',
  },
  {
    date: '2026-11-20',
    title: 'Inter-House Swimming Competition Holiday',
    kind: 'holiday',
  },
  {
    date: '2026-12-17',
    title: 'BS Formal Dinner (Christmas Dinner)',
    kind: 'event',
  },
  { date: '2026-12-18', title: 'Christmas Service', kind: 'event' },
  {
    date: '2027-01-01',
    title: 'The first day of January',
    kind: 'holiday',
  },
  {
    date: '2027-01-06',
    title: 'G7 Character Building Programme (Day 3)',
    kind: 'event',
  },
  {
    date: '2027-03-02',
    title: 'Tuesday adopts Friday timetable',
    kind: 'timetable',
  },
  { date: '2027-03-25', title: 'Easter Service', kind: 'event' },
  {
    date: '2027-05-01',
    title: 'Labour Day',
    kind: 'holiday',
  },
  {
    date: '2027-05-10',
    title: 'Monday adopts Thursday timetable',
    kind: 'timetable',
  },
  {
    date: '2027-05-12',
    title: 'Staff Development Day',
    kind: 'non-school-day',
  },
  {
    date: '2027-05-13',
    title: 'The Birthday of the Buddha',
    kind: 'holiday',
  },
  { date: '2027-06-09', title: 'Tuen Ng Festival', kind: 'holiday' },
  {
    date: '2027-07-01',
    title: 'Hong Kong Special Administrative Region Establishment Day',
    kind: 'holiday',
  },
  {
    date: '2027-07-12',
    title: 'End of School Year Service',
    kind: 'event',
  },
]

const RANGE_ROWS: RangeRow[] = [
  {
    from: '2026-12-21',
    to: '2026-12-27',
    title: 'Christmas & New Year Holiday',
    kind: 'holiday',
    named: {
      '2026-12-25': 'Christmas Day',
      '2026-12-26': 'The first weekday after Christmas Day',
    },
  },
  {
    from: '2027-02-03',
    to: '2027-02-10',
    title: 'Lunar New Year Holiday',
    kind: 'holiday',
    named: {
      '2027-02-06': "Lunar New Year's Day",
      '2027-02-07': 'The second day of Lunar New Year',
      '2027-02-08': 'The third day of Lunar New Year',
      '2027-02-09': 'The fourth day of Lunar New Year',
    },
  },
  {
    from: '2027-03-26',
    to: '2027-03-31',
    title: 'Easter Holiday',
    kind: 'holiday',
    named: {
      '2027-03-26': 'Good Friday',
      '2027-03-27': 'The day following Good Friday',
      '2027-03-29': 'Easter Monday',
    },
  },
  {
    from: '2027-04-01',
    to: '2027-04-05',
    title: 'Ching Ming Holiday',
    kind: 'holiday',
    named: {
      '2027-04-05': 'Ching Ming Festival',
    },
  },
  {
    from: '2027-07-13',
    to: '2027-08-31',
    title: 'Summer Holiday',
    kind: 'holiday',
  },
]

function expandRange(row: RangeRow): SchoolCalendarRow[] {
  return expandIsoDateRange(row.from, row.to).map((date) => ({
    date,
    title: row.named?.[date] ?? row.title,
    kind: row.kind,
  }))
}

/** Flat 2026/27 school-calendar rows (one per date). */
export function buildSchoolCalendar2627Rows(): SchoolCalendarRow[] {
  const byDate = new Map<string, SchoolCalendarRow>()

  for (const row of SINGLE_ROWS) {
    byDate.set(row.date, row)
  }

  for (const range of RANGE_ROWS) {
    for (const row of expandRange(range)) {
      if (!byDate.has(row.date)) byDate.set(row.date, row)
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export const SCHOOL_YEAR_2627 = {
  label: '2026/27',
  validFrom: '2026-09-01',
  validTo: '2027-08-31',
  teachingUntil: '2027-07-12',
  totalSchoolDays: 190,
  staffDevelopmentDays: ['2026-09-04', '2026-11-10', '2027-05-12'] as const,
} as const
