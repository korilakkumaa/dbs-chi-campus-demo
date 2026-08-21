import type { CalendarEvent, CalendarEventKind } from '../types'

/** Bump when seed calendar changes so stale localStorage does not hide updates. */
export const CALENDAR_EVENTS_KEY = 'campus-calendar-events-v5'

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

type SeedRow = {
  date: string
  title: string
  kind: CalendarEventKind
}

const SCHOOL_YEAR_ROWS: SeedRow[] = [
  { date: '2025-09-01', title: 'First House Meeting', kind: 'event' },
  {
    date: '2025-09-05',
    title:
      'Beginning of School Year Staff Development Day and Commissioning Service; Non School Day',
    kind: 'non-school-day',
  },
  { date: '2025-09-11', title: 'Thursday adopts Friday timetable', kind: 'timetable' },
  { date: '2025-09-12', title: 'Inter-House Swimming Finals', kind: 'event' },
  { date: '2025-09-27', title: 'PTA Election Day', kind: 'event' },
  { date: '2025-10-01', title: 'National Day', kind: 'holiday' },
  {
    date: '2025-10-07',
    title: 'The day following the Chinese Mid-Autumn Festival',
    kind: 'holiday',
  },
  {
    date: '2025-10-10',
    title: 'Inter-School Swimming Competition (Day 1)',
    kind: 'event',
  },
  { date: '2025-10-15', title: 'Second House Meeting', kind: 'event' },
  {
    date: '2025-10-17',
    title: 'Inter-School Swimming Competition (Finals)',
    kind: 'event',
  },
  {
    date: '2025-10-22',
    title: 'First Information Session on G10 Streaming for G9',
    kind: 'event',
  },
  {
    date: '2025-10-24',
    title: 'G7 Character Building Programme (Day 2); Apple Race',
    kind: 'event',
  },
  {
    date: '2025-10-25',
    title: 'PTA AGM and Inauguration Ceremony',
    kind: 'event',
  },
  { date: '2025-10-29', title: 'Chung Yeung Festival', kind: 'holiday' },
  { date: '2025-11-09', title: 'Garden Fete', kind: 'event' },
  {
    date: '2025-11-10',
    title: 'The day following Garden Fete',
    kind: 'holiday',
  },
  {
    date: '2025-11-20',
    title: 'Inter-School Athletics Competition (Day 1)',
    kind: 'event',
  },
  {
    date: '2025-11-21',
    title:
      'Inter-School Life Saving Competition; IB G10 Mid-year Exam; IB G11 Mid-year Exam',
    kind: 'event',
  },
  {
    date: '2025-11-25',
    title: 'Inter-School Athletics Competition (Day 2)',
    kind: 'event',
  },
  {
    date: '2025-11-28',
    title: 'Inter-School Athletics Competition (Day 3)',
    kind: 'event',
  },
  { date: '2025-12-01', title: 'G7-G11 Mid-year Exam', kind: 'event' },
  {
    date: '2025-12-08',
    title: 'The day following the Legislative Council General Election',
    kind: 'holiday',
  },
  { date: '2025-12-09', title: 'G7-G11 Mid-year Exam', kind: 'event' },
  { date: '2025-12-19', title: 'Christmas Service', kind: 'event' },
  {
    date: '2025-12-22',
    title: 'Christmas & New Year Holidays',
    kind: 'holiday',
  },
  { date: '2025-12-24', title: 'Christmas Eve', kind: 'holiday' },
  { date: '2025-12-25', title: 'Christmas Day', kind: 'holiday' },
  {
    date: '2025-12-26',
    title: 'The first weekday after Christmas Day',
    kind: 'holiday',
  },
  { date: '2026-01-01', title: 'The first day of January', kind: 'holiday' },
  {
    date: '2026-01-02',
    title: 'Return of marked scripts (G7-G11); G12 Mock Exam',
    kind: 'event',
  },
  {
    date: '2026-01-06',
    title: 'G7 Character Building Programme (Day 3)',
    kind: 'event',
  },
  {
    date: '2026-01-19',
    title: 'Checking of result slips (G7-G11)',
    kind: 'event',
  },
  {
    date: '2026-01-26',
    title: 'Inter-House Athletics Competitions',
    kind: 'event',
  },
  {
    date: '2026-01-27',
    title: 'Return of marked scripts (G12)',
    kind: 'event',
  },
  {
    date: '2026-01-31',
    title:
      "Parents' Day (Distribution of report cards G7-G11, IB G10-G12)",
    kind: 'event',
  },
  {
    date: '2026-02-06',
    title: 'Checking of result slips (G12)',
    kind: 'event',
  },
  { date: '2026-02-10', title: 'Tuesday adopts Monday timetable', kind: 'timetable' },
  {
    date: '2026-02-11',
    title: 'Distribution of report cards (G12)',
    kind: 'event',
  },
  { date: '2026-02-13', title: 'G12 Graduation Ceremony', kind: 'event' },
  {
    date: '2026-02-16',
    title: 'Lunar New Year Holidays',
    kind: 'holiday',
  },
  { date: '2026-02-17', title: "Lunar New Year's Day", kind: 'holiday' },
  {
    date: '2026-02-18',
    title: 'The second day of Lunar New Year',
    kind: 'holiday',
  },
  {
    date: '2026-02-19',
    title: 'The third day of Lunar New Year',
    kind: 'holiday',
  },
  { date: '2026-02-25', title: 'IB G12 Mock Exam', kind: 'event' },
  { date: '2026-03-02', title: 'Music Festival', kind: 'event' },
  {
    date: '2026-03-03',
    title: 'Inter-School Cross Country Competition (Tentative)',
    kind: 'event',
  },
  {
    date: '2026-03-12',
    title: 'Staff Development Day; Non School Day',
    kind: 'non-school-day',
  },
  {
    date: '2026-03-13',
    title: 'Inter-House Swimming Competition Holiday',
    kind: 'holiday',
  },
  {
    date: '2026-03-16',
    title: 'Inter-House Athletics Competition Holiday',
    kind: 'holiday',
  },
  { date: '2026-03-17', title: 'Tuesday adopts Monday timetable', kind: 'timetable' },
  {
    date: '2026-03-18',
    title: 'Second Information Session on G10 Streaming for G9',
    kind: 'event',
  },
  {
    date: '2026-03-28',
    title: 'Mentoring Scheme (Tea Reception)',
    kind: 'event',
  },
  { date: '2026-04-01', title: 'Easter Service', kind: 'event' },
  { date: '2026-04-02', title: 'Easter Holidays', kind: 'holiday' },
  { date: '2026-04-03', title: 'Good Friday', kind: 'holiday' },
  {
    date: '2026-04-04',
    title: 'The day following Good Friday',
    kind: 'holiday',
  },
  {
    date: '2026-04-06',
    title: 'The day following Ching Ming Festival',
    kind: 'holiday',
  },
  {
    date: '2026-04-07',
    title: 'The day following Easter Monday',
    kind: 'holiday',
  },
  { date: '2026-04-09', title: 'HKDSE Core subject exams', kind: 'event' },
  { date: '2026-04-14', title: 'IB G12 Study Leave', kind: 'event' },
  { date: '2026-04-21', title: 'G10 Leadership Training Camp', kind: 'event' },
  { date: '2026-04-27', title: 'IB G12 Exam', kind: 'event' },
  { date: '2026-04-28', title: 'G9 TSA Speaking Assessments', kind: 'event' },
  { date: '2026-05-01', title: 'Labour Day', kind: 'holiday' },
  {
    date: '2026-05-04',
    title: 'G9 TSA Speaking Assessments (as the fallback date)',
    kind: 'event',
  },
  {
    date: '2026-05-06',
    title: 'Third Information Session on G10 Streaming for G9',
    kind: 'event',
  },
  { date: '2026-05-14', title: 'Thursday adopts Friday timetable', kind: 'timetable' },
  {
    date: '2026-05-15',
    title: 'HKSKH Staff Development Day; Non School Day',
    kind: 'non-school-day',
  },
  {
    date: '2026-05-25',
    title: 'The day following the Birthday of the Buddha',
    kind: 'holiday',
  },
  { date: '2026-05-27', title: 'Wednesday adopts Monday timetable', kind: 'timetable' },
  {
    date: '2026-06-01',
    title: 'G7-G11 Final Exam; IB G10 & G11 Final Exam',
    kind: 'event',
  },
  { date: '2026-06-17', title: 'G9 TSA Written Assessments', kind: 'event' },
  { date: '2026-06-19', title: 'Tuen Ng Festival', kind: 'holiday' },
  { date: '2026-06-23', title: 'Return of marked scripts', kind: 'event' },
  {
    date: '2026-06-24',
    title: 'G9 TSA Written Assessments (as the fallback date)',
    kind: 'event',
  },
  {
    date: '2026-07-01',
    title: 'Hong Kong Special Administrative Region Establishment Day',
    kind: 'holiday',
  },
  {
    date: '2026-07-03',
    title: 'Checking of Result Slips (G9)',
    kind: 'event',
  },
  {
    date: '2026-07-06',
    title: 'Checking of Result Slips (G7, G8, G10 & G11)',
    kind: 'event',
  },
  {
    date: '2026-07-08',
    title: 'Distribution of Report Cards (copy) & Overall Form Position to G9',
    kind: 'event',
  },
  {
    date: '2026-07-10',
    title: "IB G10 & G11 Parents' Day; Homecoming Concert 2026 (Tentative)",
    kind: 'event',
  },
  { date: '2026-07-13', title: 'Distribution of Report Cards', kind: 'event' },
  {
    date: '2026-07-14',
    title: 'Pre-S1 Hong Kong Attainment Test',
    kind: 'event',
  },
  {
    date: '2026-07-15',
    title: 'Release of 2026 HKDSE Examination Results (Tentative)',
    kind: 'event',
  },
  { date: '2026-07-16', title: 'Summer Holidays', kind: 'holiday' },
  {
    date: '2026-07-20',
    title: 'G7-G11 Supplementary Examinations',
    kind: 'event',
  },
  { date: '2026-08-06', title: 'World Choir Games', kind: 'event' },
  {
    date: '2026-08-22',
    title: 'G7 Orientation Program II / Entrance Convocation',
    kind: 'event',
  },
  {
    date: '2026-08-26',
    title: 'First Staff Meeting (TBC) & IB Staff Meeting Part 1 (Pending)',
    kind: 'event',
  },
  {
    date: '2026-08-27',
    title: 'IB Staff Meeting Part 2 & IB New Students Induction Day (Pending)',
    kind: 'event',
  },
  {
    date: '2026-08-28',
    title: 'IB Staff Meeting Part 3 (Pending)',
    kind: 'event',
  },
]

export const seedCalendarEvents: CalendarEvent[] = SCHOOL_YEAR_ROWS.map(
  (row, index) => ({
    id: `ce-sy-${String(index + 1).padStart(3, '0')}`,
    date: row.date,
    title: row.title,
    kind: row.kind,
    createdBy: 'u-admin',
    audience: { type: 'all' },
  }),
)

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CALENDAR_EVENTS_KEY)
    if (!raw) return [...seedCalendarEvents]
    const parsed = JSON.parse(raw) as CalendarEvent[]
    return Array.isArray(parsed) ? parsed : [...seedCalendarEvents]
  } catch {
    return [...seedCalendarEvents]
  }
}

export function saveCalendarEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(events))
  } catch {
    /* ignore quota / private mode */
  }
}

export function newCalendarEventId(): string {
  return `ce-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
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

export function isoDateLocal(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function eventInMonth(event: CalendarEvent, year: number, monthIndex: number) {
  return event.date.startsWith(monthKey(year, monthIndex))
}
