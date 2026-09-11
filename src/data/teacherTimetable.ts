import type { CalendarEvent } from '../types'
import {
  academicYearStartFromIso,
  formatAcademicYearLabel,
} from './academicYear'
import { isoDateLocal, mondayOfWeekIso, schoolWeekDates, dayStatusCustomNote } from './calendarEvents'
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

/** Poster-muted swatches: terracotta / navy / mustard / warm cream. */
const CLASS_HIGHLIGHTS: Record<string, ClassHighlight> = {
  G7P: { accent: '#d6453d', soft: 'rgba(214, 69, 61, 0.22)', text: '#7a2a24' },
  G7L: { accent: '#224c73', soft: 'rgba(34, 76, 115, 0.22)', text: '#1b3b5f' },
  G7A: { accent: '#d9a74a', soft: 'rgba(217, 167, 74, 0.24)', text: '#6b4e18' },
  G7S: { accent: '#3a6b8c', soft: 'rgba(58, 107, 140, 0.22)', text: '#1e3a4f' },
  G7J: { accent: '#6b5344', soft: 'rgba(107, 83, 68, 0.22)', text: '#4a2e20' },
  'G11M, G11P': {
    accent: '#6b5344',
    soft: 'rgba(107, 83, 68, 0.22)',
    text: '#4a2e20',
  },
  'G11P, G11M': {
    accent: '#6b5344',
    soft: 'rgba(107, 83, 68, 0.22)',
    text: '#4a2e20',
  },
  G11M: { accent: '#c85a3a', soft: 'rgba(200, 90, 58, 0.22)', text: '#6b3020' },
  G11P: { accent: '#8b7355', soft: 'rgba(139, 115, 85, 0.22)', text: '#4a3a28' },
  'G9 EC': {
    accent: '#3a5f5c',
    soft: 'rgba(58, 95, 92, 0.22)',
    text: '#243f3c',
  },
  'G9G, G9L': {
    accent: '#3a5f5c',
    soft: 'rgba(58, 95, 92, 0.22)',
    text: '#243f3c',
  },
  '12L': { accent: '#4a5a6b', soft: 'rgba(74, 90, 107, 0.22)', text: '#2a3440' },
}

const FALLBACK_HIGHLIGHTS: ClassHighlight[] = [
  { accent: '#d6453d', soft: 'rgba(214, 69, 61, 0.22)', text: '#7a2a24' },
  { accent: '#224c73', soft: 'rgba(34, 76, 115, 0.22)', text: '#1b3b5f' },
  { accent: '#3a6b8c', soft: 'rgba(58, 107, 140, 0.22)', text: '#1e3a4f' },
  { accent: '#d9a74a', soft: 'rgba(217, 167, 74, 0.24)', text: '#6b4e18' },
  { accent: '#6b5344', soft: 'rgba(107, 83, 68, 0.22)', text: '#4a2e20' },
  { accent: '#3a5f5c', soft: 'rgba(58, 95, 92, 0.22)', text: '#243f3c' },
]

/**
 * Grade × subject family swatches for personal timetable.
 * Muted poster palette; within each grade subjects stay distinct, and
 * neighbouring-grade CHIN tones (esp. G9 mustard vs G10 steel) stay apart.
 */
const LESSON_KIND_HIGHLIGHTS: Record<string, ClassHighlight> = {
  // G7 — terracotta / navy / mustard / steel
  '7-CHIN': { accent: '#d6453d', soft: 'rgba(214, 69, 61, 0.28)', text: '#7a2a24' },
  '7-CHIS': { accent: '#224c73', soft: 'rgba(34, 76, 115, 0.28)', text: '#1b3b5f' },
  '7-PTH': { accent: '#d9a74a', soft: 'rgba(217, 167, 74, 0.32)', text: '#6b4e18' },
  '7-EC': { accent: '#5a7a94', soft: 'rgba(90, 122, 148, 0.28)', text: '#2a4055' },
  // G8 — deep terracotta / deep navy / ochre / mid navy
  '8-CHIN': { accent: '#b84838', soft: 'rgba(184, 72, 56, 0.28)', text: '#6b2a20' },
  '8-CHIS': { accent: '#1b3b5f', soft: 'rgba(27, 59, 95, 0.28)', text: '#14283f' },
  '8-PTH': { accent: '#c49a3c', soft: 'rgba(196, 154, 60, 0.30)', text: '#6b5218' },
  '8-EC': { accent: '#3a6b8c', soft: 'rgba(58, 107, 140, 0.28)', text: '#1e3a4f' },
  // G9 — mustard / mid navy / terracotta / olive
  '9-CHIN': { accent: '#d9a74a', soft: 'rgba(217, 167, 74, 0.34)', text: '#6b4e18' },
  '9-CHIS': { accent: '#2a5578', soft: 'rgba(42, 85, 120, 0.28)', text: '#1b3b5f' },
  '9-PTH': { accent: '#d6453d', soft: 'rgba(214, 69, 61, 0.28)', text: '#7a2a24' },
  '9-EC': { accent: '#5a6b45', soft: 'rgba(90, 107, 69, 0.28)', text: '#3a4528' },
  // G10 — steel / dusty rose / deep ochre / teal-navy
  '10-CHIN': { accent: '#3a6b8c', soft: 'rgba(58, 107, 140, 0.28)', text: '#1e3a4f' },
  '10-CHIS': { accent: '#b85a52', soft: 'rgba(184, 90, 82, 0.28)', text: '#6b302c' },
  '10-PTH': { accent: '#a87830', soft: 'rgba(168, 120, 48, 0.30)', text: '#5c4018' },
  '10-EC': { accent: '#3a5f5c', soft: 'rgba(58, 95, 92, 0.28)', text: '#243f3c' },
  // G11 — deep navy / warm terracotta / forest-teal / light mustard
  '11-CHIN': { accent: '#1d4477', soft: 'rgba(29, 68, 119, 0.28)', text: '#14283f' },
  '11-CHIS': { accent: '#c85a3a', soft: 'rgba(200, 90, 58, 0.28)', text: '#6b3020' },
  '11-PTH': { accent: '#355447', soft: 'rgba(53, 84, 71, 0.28)', text: '#1e332a' },
  '11-EC': { accent: '#e5b25d', soft: 'rgba(229, 178, 93, 0.32)', text: '#6b5218' },
  // G12 — sky navy / deep terracotta / slate / mustard
  '12-CHIN': { accent: '#4a7a9a', soft: 'rgba(74, 122, 154, 0.28)', text: '#1e3a4f' },
  '12-CHIS': { accent: '#b83a32', soft: 'rgba(184, 58, 50, 0.28)', text: '#6b2419' },
  '12-PTH': { accent: '#4a5a6b', soft: 'rgba(74, 90, 107, 0.28)', text: '#2a3440' },
  '12-EC': { accent: '#d4a017', soft: 'rgba(212, 160, 23, 0.32)', text: '#6b5218' },
}

const OTHER_LESSON_HIGHLIGHTS: ClassHighlight[] = [
  { accent: '#a87830', soft: 'rgba(168, 120, 48, 0.28)', text: '#5c4018' },
  { accent: '#3a6b8c', soft: 'rgba(58, 107, 140, 0.28)', text: '#1e3a4f' },
  { accent: '#6b5344', soft: 'rgba(107, 83, 68, 0.28)', text: '#4a2e20' },
  { accent: '#4a5a6b', soft: 'rgba(74, 90, 107, 0.28)', text: '#2a3440' },
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

/** Committed seed grids keyed by academic-year start (2025 → 2025/26, …). */
const SEED_TIMETABLES_BY_YEAR: Record<
  number,
  Record<string, TeacherTimetableEntry>
> = {
  2025: TEACHER_WEEKLY_2526,
  2026: TEACHER_WEEKLY_2627,
}

/** Runtime overlays from Supabase (set by timetableStore after hydrate/save). */
const TIMETABLE_OVERLAY: Record<
  number,
  Record<string, TeacherTimetableEntry>
> = {}

export function setTeacherTimetableOverlay(
  startYear: number,
  timetables: Record<string, TeacherTimetableEntry> | null,
): void {
  if (timetables == null) {
    delete TIMETABLE_OVERLAY[startYear]
    return
  }
  TIMETABLE_OVERLAY[startYear] = timetables
}

/** Seed-only map (ignores remote overlay). */
export function seedTimetablesForYear(
  startYear: number,
): Record<string, TeacherTimetableEntry> {
  return SEED_TIMETABLES_BY_YEAR[startYear] ?? {}
}

export function seedTimetableYears(): number[] {
  return Object.keys(SEED_TIMETABLES_BY_YEAR)
    .map(Number)
    .filter((y) => Object.keys(SEED_TIMETABLES_BY_YEAR[y] ?? {}).length > 0)
    .sort((a, b) => a - b)
}

export function hasSeedTimetableYear(startYear: number): boolean {
  return Object.keys(seedTimetablesForYear(startYear)).length > 0
}

/** Resolve imported timetable for a teacher and academic year. */
export function teacherTimetableEntry(
  teacherId: string,
  startYear: number,
): TeacherTimetableEntry | null {
  return (
    TIMETABLE_OVERLAY[startYear]?.[teacherId] ??
    SEED_TIMETABLES_BY_YEAR[startYear]?.[teacherId] ??
    null
  )
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
  const map = weeklyTimetablesForYear(startYear)
  return Object.keys(map).length > 0
}

/** Academic years with imported weekly timetables (newest first). */
export function listTimetableAcademicYearStarts(): number[] {
  const years = new Set([
    ...Object.keys(SEED_TIMETABLES_BY_YEAR).map(Number),
    ...Object.keys(TIMETABLE_OVERLAY).map(Number),
  ])
  return [...years]
    .filter((y) => hasTimetableForSchoolYear(y))
    .sort((a, b) => b - a)
}

/** All imported teacher grids for one academic year (overlay wins over seed). */
export function weeklyTimetablesForYear(
  startYear: number,
): Record<string, TeacherTimetableEntry> {
  return TIMETABLE_OVERLAY[startYear] ?? SEED_TIMETABLES_BY_YEAR[startYear] ?? {}
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
    const currentCount = Object.keys(weeklyTimetablesForYear(currentStart)).length
    const nextCount = Object.keys(weeklyTimetablesForYear(nextStart)).length
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

/** @deprecated Prefer weeklyTimetablesForYear(startYear) so overlays apply. */
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
    for (const id of Object.keys(weeklyTimetablesForYear(startYear))) ids.add(id)
  } else {
    for (const y of listTimetableAcademicYearStarts()) {
      for (const id of Object.keys(weeklyTimetablesForYear(y))) ids.add(id)
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
  startYear: number = DEFAULT_TIMETABLE_ACADEMIC_YEAR_START,
): boolean {
  const entry = teacherTimetableEntry(teacherId, startYear)
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
  for (const y of listTimetableAcademicYearStarts()) {
    if (weeklyTimetablesForYear(y)[userId]) return userId
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
  if (holiday) {
    return {
      status: 'holiday',
      title: dayStatusCustomNote(holiday) ?? '',
    }
  }

  const nonSchool = findDayMark(events, iso, teacherId, 'non-school-day')
  if (nonSchool) {
    return {
      status: 'non-school-day',
      title: dayStatusCustomNote(nonSchool) ?? undefined,
    }
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
