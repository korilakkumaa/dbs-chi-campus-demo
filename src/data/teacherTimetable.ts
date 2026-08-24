import type { CalendarEvent } from '../types'
import {
  academicYearStartFromIso,
  formatAcademicYearLabel,
} from './academicYear'
import { isoDateLocal, mondayOfWeekIso, schoolWeekDates } from './calendarEvents'
import { SCHOOL_YEAR_2526 } from './schoolCalendar2526'
import { SCHOOL_YEAR_2627 } from './schoolCalendar2627'
import { teacherWhitelist, teacherWhitelistForYear } from './teacherWhitelist'
import { TEACHER_WEEKLY_2526 } from './teacherWeekly2526.generated'
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
  'G11P, G11M': {
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

/** Vivid swatches for grade × subject family (personal week grid). */
const LESSON_KIND_HIGHLIGHTS: Record<string, ClassHighlight> = {
  // G7
  '7-CHIN': { accent: '#e03d2a', soft: 'rgba(224, 61, 42, 0.28)', text: '#6e1c14' },
  '7-CHIS': { accent: '#c45c16', soft: 'rgba(196, 92, 22, 0.28)', text: '#6a2e0c' },
  '7-PTH': { accent: '#d4890a', soft: 'rgba(212, 137, 10, 0.28)', text: '#6b4708' },
  '7-EC': { accent: '#b45309', soft: 'rgba(180, 83, 9, 0.28)', text: '#6b3208' },
  // G8
  '8-CHIN': { accent: '#0d9488', soft: 'rgba(13, 148, 136, 0.28)', text: '#0f4a44' },
  '8-CHIS': { accent: '#059669', soft: 'rgba(5, 150, 105, 0.28)', text: '#0a4a36' },
  '8-PTH': { accent: '#16a34a', soft: 'rgba(22, 163, 74, 0.28)', text: '#14532d' },
  '8-EC': { accent: '#65a30d', soft: 'rgba(101, 163, 13, 0.28)', text: '#3f6212' },
  // G9
  '9-CHIN': { accent: '#2563eb', soft: 'rgba(37, 99, 235, 0.28)', text: '#1e3a8a' },
  '9-CHIS': { accent: '#4f46e5', soft: 'rgba(79, 70, 229, 0.28)', text: '#312e81' },
  '9-PTH': { accent: '#7c3aed', soft: 'rgba(124, 58, 237, 0.28)', text: '#4c1d95' },
  '9-EC': { accent: '#9333ea', soft: 'rgba(147, 51, 234, 0.28)', text: '#581c87' },
  // G10
  '10-CHIN': { accent: '#db2777', soft: 'rgba(219, 39, 119, 0.28)', text: '#9d174d' },
  '10-CHIS': { accent: '#e11d48', soft: 'rgba(225, 29, 72, 0.28)', text: '#9f1239' },
  '10-PTH': { accent: '#f43f5e', soft: 'rgba(244, 63, 94, 0.26)', text: '#9f1239' },
  '10-EC': { accent: '#be185d', soft: 'rgba(190, 24, 93, 0.28)', text: '#9d174d' },
  // G11
  '11-CHIN': { accent: '#7c3aed', soft: 'rgba(124, 58, 237, 0.26)', text: '#4c1d95' },
  '11-CHIS': { accent: '#6366f1', soft: 'rgba(99, 102, 241, 0.28)', text: '#3730a3' },
  '11-PTH': { accent: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.28)', text: '#5b21b6' },
  '11-EC': { accent: '#a855f7', soft: 'rgba(168, 85, 247, 0.28)', text: '#6b21a8' },
  // G12
  '12-CHIN': { accent: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.28)', text: '#075985' },
  '12-CHIS': { accent: '#0284c7', soft: 'rgba(2, 132, 199, 0.28)', text: '#0c4a6e' },
  '12-PTH': { accent: '#06b6d4', soft: 'rgba(6, 182, 212, 0.28)', text: '#155e75' },
  '12-EC': { accent: '#0891b2', soft: 'rgba(8, 145, 178, 0.28)', text: '#155e75' },
}

const OTHER_LESSON_HIGHLIGHTS: ClassHighlight[] = [
  { accent: '#ea580c', soft: 'rgba(234, 88, 12, 0.28)', text: '#9a3412' },
  { accent: '#ca8a04', soft: 'rgba(202, 138, 4, 0.28)', text: '#854d0e' },
  { accent: '#64748b', soft: 'rgba(100, 116, 139, 0.28)', text: '#334155' },
  { accent: '#78716c', soft: 'rgba(120, 113, 108, 0.28)', text: '#44403c' },
]

function normalizeGroupKey(group: string) {
  return group.replace(/\s+/g, ' ').trim()
}

function subjectKind(subject: string): string {
  const s = subject.trim().toUpperCase()
  if (s.startsWith('CHIN')) return 'CHIN'
  if (s === 'CHIS') return 'CHIS'
  if (s === 'PTH') return 'PTH'
  if (s === 'EC') return 'EC'
  return 'OTHER'
}

function gradeFromGroup(group: string): number | null {
  const first = group.split(/[,/]/)[0]?.trim() ?? ''
  const m = first.match(/^(?:G)?(12|11|10|[789])/i)
  return m ? Number(m[1]) : null
}

function hashKey(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function classHighlight(group: string): ClassHighlight {
  const key = normalizeGroupKey(group)
  if (CLASS_HIGHLIGHTS[key]) return CLASS_HIGHLIGHTS[key]

  const first = key.split(/[,/]/)[0]?.trim()
  if (first && CLASS_HIGHLIGHTS[first]) return CLASS_HIGHLIGHTS[first]

  return FALLBACK_HIGHLIGHTS[hashKey(key) % FALLBACK_HIGHLIGHTS.length]
}

/**
 * Highlight by grade × subject family (e.g. G7 中文、G7 中史、G12 中文).
 * Shared by personal weekly grid and detailed-calendar day panel.
 */
export function lessonHighlight(group: string, subject: string): ClassHighlight {
  const grade = gradeFromGroup(group)
  const kind = subjectKind(subject)
  if (grade != null && kind !== 'OTHER') {
    const keyed = LESSON_KIND_HIGHLIGHTS[`${grade}-${kind}`]
    if (keyed) return keyed
  }
  const fallbackKey = `${grade ?? 'x'}-${kind}-${normalizeGroupKey(group)}`
  return OTHER_LESSON_HIGHLIGHTS[
    hashKey(fallbackKey) % OTHER_LESSON_HIGHLIGHTS.length
  ]
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

/** Per-year academic windows (from official school calendars). */
const ACADEMIC_YEAR_WINDOWS: Record<number, AcademicYearWindow> = {
  2025: {
    label: SCHOOL_YEAR_2526.label,
    validFrom: SCHOOL_YEAR_2526.validFrom,
    validTo: SCHOOL_YEAR_2526.validTo,
    teachingUntil: SCHOOL_YEAR_2526.teachingUntil,
  },
  2026: {
    label: SCHOOL_YEAR_2627.label,
    validFrom: SCHOOL_YEAR_2627.validFrom,
    validTo: SCHOOL_YEAR_2627.validTo,
    teachingUntil: SCHOOL_YEAR_2627.teachingUntil,
  },
}

/** Academic year window for an ISO date (Sep–Aug). */
export function academicYearWindowForIso(iso: string): AcademicYearWindow {
  const startYear = academicYearStartFromIso(iso)
  const known = ACADEMIC_YEAR_WINDOWS[startYear]
  if (known) return known
  return {
    label: formatAcademicYearLabel(startYear),
    validFrom: `${startYear}-09-01`,
    validTo: `${startYear + 1}-08-31`,
    teachingUntil: `${startYear + 1}-07-12`,
  }
}

/** Weekly grids keyed by academic-year start (2025 → 2025/26, 2026 → 2026/27). */
const TIMETABLES_BY_YEAR: Record<
  number,
  Record<string, TeacherTimetableEntry>
> = {
  2025: TEACHER_WEEKLY_2526,
  2026: TEACHER_WEEKLY_2627,
}

/** Resolve imported timetable for a teacher and academic year. */
export function teacherTimetableEntry(
  teacherId: string,
  startYear: number,
): TeacherTimetableEntry | null {
  return TIMETABLES_BY_YEAR[startYear]?.[teacherId] ?? null
}

/** Whether this teacher has an imported grid for the given academic year. */
export function hasTeacherTimetableForYear(
  teacherId: string,
  startYear: number,
): boolean {
  return teacherTimetableEntry(teacherId, startYear) != null
}

/** Whether we have any weekly timetable data for this academic year. */
export function hasTimetableForSchoolYear(startYear: number): boolean {
  const map = TIMETABLES_BY_YEAR[startYear]
  return map != null && Object.keys(map).length > 0
}

/** Academic years with imported weekly timetables (newest first). */
export function listTimetableAcademicYearStarts(): number[] {
  return Object.keys(TIMETABLES_BY_YEAR)
    .map(Number)
    .filter((y) => hasTimetableForSchoolYear(y))
    .sort((a, b) => b - a)
}

/** All imported teacher grids for one academic year. */
export function weeklyTimetablesForYear(
  startYear: number,
): Record<string, TeacherTimetableEntry> {
  return TIMETABLES_BY_YEAR[startYear] ?? {}
}

/**
 * Default week for the personal timetable view.
 * Before 1 Sep, open the upcoming year's first school week when it has fuller imports.
 */
export function defaultTimetableWeekMonday(today = isoDateLocal()): string {
  const currentStart = academicYearStartFromIso(today)
  const nextStart = currentStart + 1
  const sep1 = `${nextStart}-09-01`
  if (today < sep1 && hasTimetableForSchoolYear(nextStart)) {
    const currentCount = Object.keys(TIMETABLES_BY_YEAR[currentStart] ?? {}).length
    const nextCount = Object.keys(TIMETABLES_BY_YEAR[nextStart] ?? {}).length
    if (nextCount > currentCount) {
      return mondayOfWeekIso(sep1)
    }
  }
  return mondayOfWeekIso(today)
}

/**
 * Academic year used to pick teacher list / grid template for a school week.
 * If the week spans 31 Aug + 1 Sep, prefer the newer year (full timetables from 1 Sep).
 */
export function timetableViewStartYear(weekMonday: string): number {
  let startYear = academicYearStartFromIso(weekMonday)
  for (const iso of schoolWeekDates(weekMonday)) {
    startYear = Math.max(startYear, academicYearStartFromIso(iso))
  }
  return startYear
}

/** Default export: 2026/27 grids (used by grade distribution views). */
export const DEFAULT_TIMETABLE_ACADEMIC_YEAR_START = 2026

export const TEACHER_WEEKLY_TIMETABLES: Record<string, TeacherTimetableEntry> =
  TEACHER_WEEKLY_2627

export type TimetableTeacherOption = {
  teacherId: string
  initial: string
  name: string
}

/** Teachers with imported weekly timetables, sorted by initial (A–Z). */
export function listTeachersWithTimetables(
  startYear?: number,
): TimetableTeacherOption[] {
  const ids = new Set<string>()
  if (startYear != null) {
    const map = TIMETABLES_BY_YEAR[startYear]
    if (map) {
      for (const id of Object.keys(map)) ids.add(id)
    }
  } else {
    for (const map of Object.values(TIMETABLES_BY_YEAR)) {
      for (const id of Object.keys(map)) ids.add(id)
    }
  }
  const whitelist =
    startYear != null ? teacherWhitelistForYear(startYear) : teacherWhitelist
  return whitelist
    .filter((t) => ids.has(`u-${t.initial.toLowerCase()}`))
    .map((t) => ({
      teacherId: `u-${t.initial.toLowerCase()}`,
      initial: t.initial,
      name: t.name,
    }))
    .sort((a, b) => a.initial.localeCompare(b.initial, 'en'))
}

export function isTeacherFreeAt(
  teacherId: string,
  day: SchoolWeekday,
  start: string,
  end: string,
): boolean {
  const entry = TEACHER_WEEKLY_TIMETABLES[teacherId]
  if (!entry) return false
  const period = entry.weekly[day].find(
    (p) => p.start === start && p.end === end,
  )
  return period?.type === 'free'
}

/** Periods for a teacher on a calendar date (respects holidays & timetable swaps). */
export function getTeacherPeriodsOnDate(
  teacherId: string,
  iso: string,
  events: CalendarEvent[],
): DayPeriod[] | null {
  const result = getDayTimetable(teacherId, iso, events)
  return result.status === 'ok' ? result.periods : null
}

export function isTeacherFreeAtDate(
  teacherId: string,
  iso: string,
  start: string,
  end: string,
  events: CalendarEvent[],
): boolean {
  const periods = getTeacherPeriodsOnDate(teacherId, iso, events)
  if (!periods) return false
  const period = periods.find((p) => p.start === start && p.end === end)
  return period?.type === 'free'
}

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
  if (!userId || role === 'admin') return null
  for (const map of Object.values(TIMETABLES_BY_YEAR)) {
    if (map[userId]) return userId
  }
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

/** Whether a calendar event applies to this teacher's timetable / day preview. */
export function calendarEventTargetsTeacher(
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
      calendarEventTargetsTeacher(e, teacherId),
  )
}

export function getDayTimetable(
  teacherId: string | null,
  iso: string,
  events: CalendarEvent[],
): DayTimetableResult {
  if (!teacherId) return { status: 'no-timetable' }

  const yearWindow = academicYearWindowForIso(iso)
  const startYear = academicYearStartFromIso(iso)
  const entry = teacherTimetableEntry(teacherId, startYear)
  if (!entry) return { status: 'no-timetable' }

  if (!isDateInAcademicYear(iso, yearWindow)) {
    return { status: 'out-of-year', academicYear: yearWindow }
  }

  const holiday = findDayMark(events, iso, teacherId, 'holiday')
  if (holiday) return { status: 'holiday', title: holiday.title }

  const nonSchool = findDayMark(events, iso, teacherId, 'non-school-day')
  if (nonSchool) {
    return { status: 'non-school-day', title: nonSchool.title }
  }

  const forcedSchool = findDayMark(events, iso, teacherId, 'school-day')

  if (!forcedSchool && iso > yearWindow.teachingUntil) {
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
    academicYear: yearWindow,
  }
}
