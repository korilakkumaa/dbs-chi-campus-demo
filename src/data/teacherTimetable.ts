import type { CalendarEvent } from '../types'
import { TEACHER_WEEKLY_2627 } from './teacherWeekly2627.generated'

/** Monday=1 … Friday=5 (Date#getDay compatible for weekdays). */
export type SchoolWeekday = 1 | 2 | 3 | 4 | 5

export type DayPeriod =
  | {
      type: 'lesson'
      start: string
      end: string
      subject: string
      group: string
      room: string
    }
  | {
      type: 'break'
      start: string
      end: string
      label?: string
    }
  | {
      type: 'free'
      start: string
      end: string
    }

const WEEKDAY_NAME: Record<string, SchoolWeekday> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
}

/** Stable highlight swatches per class / teaching group. */
export type ClassHighlight = {
  accent: string
  soft: string
  text: string
}

const CLASS_HIGHLIGHTS: Record<string, ClassHighlight> = {
  G7P: { accent: '#d94a28', soft: 'rgba(217, 74, 40, 0.22)', text: '#7a2a18' },
  G7L: { accent: '#2a6b52', soft: 'rgba(42, 107, 82, 0.22)', text: '#1a3d30' },
  G7A: { accent: '#c9a010', soft: 'rgba(201, 160, 16, 0.24)', text: '#6b5610' },
  G7S: { accent: '#3d7fa0', soft: 'rgba(61, 127, 160, 0.22)', text: '#2a4f63' },
  G7J: { accent: '#8a5234', soft: 'rgba(138, 82, 52, 0.22)', text: '#4a2e20' },
  'G11M, G11P': {
    accent: '#8a5234',
    soft: 'rgba(138, 82, 52, 0.22)',
    text: '#4a2e20',
  },
  G11M: { accent: '#a85a2e', soft: 'rgba(168, 90, 46, 0.22)', text: '#5c3218' },
  G11P: { accent: '#8a5c42', soft: 'rgba(138, 92, 66, 0.22)', text: '#4a3228' },
  'G9 EC': {
    accent: '#2f7a5c',
    soft: 'rgba(47, 122, 92, 0.22)',
    text: '#1e4a38',
  },
  'G9G, G9L': {
    accent: '#2f7a5c',
    soft: 'rgba(47, 122, 92, 0.22)',
    text: '#1e4a38',
  },
  '12L': { accent: '#8a4a6e', soft: 'rgba(138, 74, 110, 0.22)', text: '#4a2840' },
}

const FALLBACK_HIGHLIGHTS: ClassHighlight[] = [
  { accent: '#d94a28', soft: 'rgba(217, 74, 40, 0.22)', text: '#7a2a18' },
  { accent: '#2a6b52', soft: 'rgba(42, 107, 82, 0.22)', text: '#1a3d30' },
  { accent: '#3d7fa0', soft: 'rgba(61, 127, 160, 0.22)', text: '#2a4f63' },
  { accent: '#c9a010', soft: 'rgba(201, 160, 16, 0.24)', text: '#6b5610' },
  { accent: '#8a5234', soft: 'rgba(138, 82, 52, 0.22)', text: '#4a2e20' },
  { accent: '#2f7a5c', soft: 'rgba(47, 122, 92, 0.22)', text: '#1e4a38' },
]

function normalizeGroupKey(group: string) {
  return group.replace(/\s+/g, ' ').trim()
}

export function classHighlight(group: string): ClassHighlight {
  const key = normalizeGroupKey(group)
  if (CLASS_HIGHLIGHTS[key]) return CLASS_HIGHLIGHTS[key]

  const first = key.split(/[,/]/)[0]?.trim()
  if (first && CLASS_HIGHLIGHTS[first]) return CLASS_HIGHLIGHTS[first]

  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return FALLBACK_HIGHLIGHTS[Math.abs(hash) % FALLBACK_HIGHLIGHTS.length]
}

/** teacherUserId → personal weekly timetable + academic year window */
export type AcademicYearWindow = {
  /** Display label, e.g. 2025/26 */
  label: string
  /** Inclusive start (YYYY-MM-DD), typically 1 Sep */
  validFrom: string
  /** Inclusive end (YYYY-MM-DD), typically 31 Aug next year */
  validTo: string
  /**
   * Last inclusive day of regular teaching within this year.
   * Dates after this (still within validTo) default to 非正常上課日
   * (e.g. Jul–Aug summer break).
   */
  teachingUntil: string
}

export type TeacherTimetableEntry = {
  academicYear: AcademicYearWindow
  weekly: Record<SchoolWeekday, DayPeriod[]>
}

/** 2026/27 Chinese department personal timetables (from CLS export). */
export const TEACHER_WEEKLY_TIMETABLES: Record<string, TeacherTimetableEntry> =
  TEACHER_WEEKLY_2627

/** Whether iso (YYYY-MM-DD) falls in the timetable's academic year. */
export function isDateInAcademicYear(
  iso: string,
  year: AcademicYearWindow,
): boolean {
  return iso >= year.validFrom && iso <= year.validTo
}

export function resolveTimetableTeacherId(
  userId: string | undefined,
  role: string | undefined,
): string | null {
  if (!userId) return null
  if (TEACHER_WEEKLY_TIMETABLES[userId]) return userId
  // Admin preview: YLN sample when admin has no personal grid.
  if (role === 'admin') return 'u-yln'
  return null
}

export function parseAdoptedWeekday(
  title: string,
): SchoolWeekday | null {
  const match = title.match(/adopts\s+(Monday|Tuesday|Wednesday|Thursday|Friday)\s+timetable/i)
  if (!match) return null
  return WEEKDAY_NAME[match[1].toLowerCase()] ?? null
}

export function effectiveSchoolWeekday(
  iso: string,
  events: CalendarEvent[],
): SchoolWeekday | null {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null

  for (const event of events) {
    if (event.date !== iso || event.kind !== 'timetable') continue
    const adopted = parseAdoptedWeekday(event.title)
    if (adopted) return adopted
  }

  const dow = date.getDay()
  if (dow >= 1 && dow <= 5) return dow as SchoolWeekday
  return null
}

export type DayTimetableResult =
  | {
      status: 'ok'
      periods: DayPeriod[]
      weekday: SchoolWeekday
      adoptedFrom: SchoolWeekday | null
      academicYear: AcademicYearWindow
    }
  | { status: 'weekend' }
  | { status: 'holiday'; title: string }
  | { status: 'non-school-day'; title?: string }
  | { status: 'no-timetable' }
  | {
      status: 'out-of-year'
      academicYear: AcademicYearWindow
    }

const WEEKDAY_LABEL: Record<SchoolWeekday, string> = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
}

export function weekdayLabel(day: SchoolWeekday) {
  return WEEKDAY_LABEL[day]
}

function eventTargetsTeacher(
  event: CalendarEvent,
  teacherId: string,
): boolean {
  const a = event.audience
  if (a.type === 'all') return true
  if (a.type === 'teachers') return a.teacherIds.includes(teacherId)
  if (a.type === 'personal') return a.ownerId === teacherId
  // Grade-scoped calendar marks still apply school-wide to personal timetables.
  if (a.type === 'grades') return true
  return false
}

function findDayMark(
  events: CalendarEvent[],
  iso: string,
  teacherId: string,
  kind: CalendarEvent['kind'],
): CalendarEvent | undefined {
  return events.find(
    (e) =>
      e.date === iso &&
      e.kind === kind &&
      eventTargetsTeacher(e, teacherId),
  )
}

export function getDayTimetable(
  teacherId: string | null,
  iso: string,
  events: CalendarEvent[],
): DayTimetableResult {
  if (!teacherId) return { status: 'no-timetable' }

  const entry = TEACHER_WEEKLY_TIMETABLES[teacherId]
  if (!entry) return { status: 'no-timetable' }

  if (!isDateInAcademicYear(iso, entry.academicYear)) {
    return { status: 'out-of-year', academicYear: entry.academicYear }
  }

  const holiday = findDayMark(events, iso, teacherId, 'holiday')
  if (holiday) return { status: 'holiday', title: holiday.title }

  const nonSchool = findDayMark(events, iso, teacherId, 'non-school-day')
  if (nonSchool) {
    return { status: 'non-school-day', title: nonSchool.title }
  }

  const forcedSchool = findDayMark(events, iso, teacherId, 'school-day')

  // After teachingUntil (e.g. Jul–Aug) → 非正常上課日 unless forced school-day
  if (
    !forcedSchool &&
    iso > entry.academicYear.teachingUntil
  ) {
    return { status: 'non-school-day' }
  }

  const naturalParts = iso.split('-').map(Number)
  const naturalDate = new Date(
    naturalParts[0],
    naturalParts[1] - 1,
    naturalParts[2],
  )
  const naturalDow = naturalDate.getDay()

  let effective = effectiveSchoolWeekday(iso, events)
  if (effective == null) {
    if (!forcedSchool) return { status: 'weekend' }
    // Forced school day on weekend: use Friday grid as fallback.
    effective = 5
  }

  const adoptedFrom =
    naturalDow >= 1 && naturalDow <= 5 && naturalDow !== effective
      ? (naturalDow as SchoolWeekday)
      : null

  return {
    status: 'ok',
    periods: entry.weekly[effective],
    weekday: effective,
    adoptedFrom,
    academicYear: entry.academicYear,
  }
}
