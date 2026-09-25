import type { CalendarEvent } from '../types'
import {
  academicYearStartFromIso,
  formatAcademicYearLabel,
} from './academicYear'
import { dayStatusCustomNote } from './calendarEvents'
import { CLASS_WEEKLY_2627 } from './classWeekly2627.generated'
import {
  academicYearWindowForIso,
  effectiveSchoolWeekday,
  isDateInAcademicYear,
  weekdayLabel,
  type AcademicYearWindow,
  type DayPeriod,
  type DayTimetableResult,
  type SchoolWeekday,
} from './teacherTimetable'

export type ClassTimetableEntry = {
  classKey: string
  /** e.g. G7 / G10 / CLP */
  gradeLabel: string
  classTeacher: string
  homeRoom: string
  academicYear: AcademicYearWindow
  weekly: Record<SchoolWeekday, DayPeriod[]>
}

export type ClassTimetableOption = {
  classKey: string
  gradeLabel: string
  displayLabel: string
  classTeacher: string
  homeRoom: string
}

/** Weekly grids keyed by academic-year start (2026 → 2026/27). */
const CLASS_TIMETABLES_BY_YEAR: Record<
  number,
  Record<string, ClassTimetableEntry>
> = {
  2026: CLASS_WEEKLY_2627,
}

function sortClassKeys(a: string, b: string): number {
  const grade = (k: string) => {
    if (k.startsWith('CLP')) return 100
    const m = k.match(/^G(\d+)/i)
    return m ? Number(m[1]) : 99
  }
  const ga = grade(a)
  const gb = grade(b)
  if (ga !== gb) return ga - gb
  return a.localeCompare(b, 'en')
}

function displayLabelFor(classKey: string): string {
  if (classKey.startsWith('CLP')) return classKey
  return classKey.replace(/^G/i, '')
}

/** Resolve imported timetable for a class and academic year. */
export function classTimetableEntry(
  classKey: string,
  startYear: number,
): ClassTimetableEntry | null {
  return CLASS_TIMETABLES_BY_YEAR[startYear]?.[classKey] ?? null
}

export function hasClassTimetableForYear(startYear: number): boolean {
  const map = CLASS_TIMETABLES_BY_YEAR[startYear]
  return map != null && Object.keys(map).length > 0
}

/** Academic years with imported class weekly timetables (newest first). */
export function listClassTimetableAcademicYearStarts(): number[] {
  return Object.keys(CLASS_TIMETABLES_BY_YEAR)
    .map(Number)
    .filter((y) => hasClassTimetableForYear(y))
    .sort((a, b) => b - a)
}

export function listClassesWithTimetables(
  startYear?: number,
): ClassTimetableOption[] {
  const years =
    startYear != null
      ? [startYear]
      : listClassTimetableAcademicYearStarts()
  const seen = new Set<string>()
  const out: ClassTimetableOption[] = []
  for (const year of years) {
    const map = CLASS_TIMETABLES_BY_YEAR[year]
    if (!map) continue
    for (const classKey of Object.keys(map).sort(sortClassKeys)) {
      if (seen.has(classKey)) continue
      seen.add(classKey)
      const entry = map[classKey]
      out.push({
        classKey,
        gradeLabel: entry.gradeLabel,
        displayLabel: displayLabelFor(classKey),
        classTeacher: entry.classTeacher,
        homeRoom: entry.homeRoom,
      })
    }
  }
  return out
}

/** Grade tabs / sidebar groups in display order. */
export function listClassTimetableGradeLabels(
  startYear?: number,
): string[] {
  const labels = new Set<string>()
  for (const opt of listClassesWithTimetables(startYear)) {
    labels.add(opt.gradeLabel)
  }
  return Array.from(labels).sort((a, b) => {
    if (a === 'CLP') return 1
    if (b === 'CLP') return -1
    const na = Number(a.replace(/\D/g, ''))
    const nb = Number(b.replace(/\D/g, ''))
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
    return a.localeCompare(b, 'en')
  })
}

function schoolWideDayMark(
  events: CalendarEvent[],
  iso: string,
  kind: CalendarEvent['kind'],
): CalendarEvent | undefined {
  return events.find((e) => {
    if (e.date !== iso || e.kind !== kind) return false
    const a = e.audience
    return a.type === 'all' || a.type === 'grades'
  })
}

/**
 * Periods for a class on a calendar date (respects holidays & timetable swaps).
 * Uses school-wide calendar marks (all / grades), not teacher-personal notes.
 */
export function getClassDayTimetable(
  classKey: string | null,
  iso: string,
  events: CalendarEvent[],
): DayTimetableResult {
  if (!classKey) return { status: 'no-timetable' }

  const yearWindow = academicYearWindowForIso(iso)
  const startYear = academicYearStartFromIso(iso)
  const entry = classTimetableEntry(classKey, startYear)
  if (!entry) return { status: 'no-timetable' }

  if (!isDateInAcademicYear(iso, yearWindow)) {
    return { status: 'out-of-year', academicYear: yearWindow }
  }

  const holiday = schoolWideDayMark(events, iso, 'holiday')
  if (holiday) {
    return {
      status: 'holiday',
      title: dayStatusCustomNote(holiday) ?? '',
    }
  }

  const nonSchool = schoolWideDayMark(events, iso, 'non-school-day')
  if (nonSchool) {
    return {
      status: 'non-school-day',
      title: dayStatusCustomNote(nonSchool) ?? undefined,
    }
  }

  const forcedSchool = schoolWideDayMark(events, iso, 'school-day')

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

export function getClassPeriodsOnDate(
  classKey: string,
  iso: string,
  events: CalendarEvent[],
): DayPeriod[] | null {
  const result = getClassDayTimetable(classKey, iso, events)
  if (result.status !== 'ok') return null
  return result.periods
}

export function countClassWeekLessons(
  classKey: string,
  weekDates: string[],
  events: CalendarEvent[],
): number {
  let count = 0
  for (const iso of weekDates) {
    const periods = getClassPeriodsOnDate(classKey, iso, events)
    if (!periods) continue
    count += periods.filter((p) => p.type === 'lesson').length
  }
  return count
}

export { weekdayLabel, formatAcademicYearLabel }
