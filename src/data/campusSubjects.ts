import type { CalendarAudience, SchoolClass, User } from '../types'
import {
  normalizeClassCode,
  splitGroupTokens,
} from './gradeChineseTimetable'
import {
  teacherTimetableEntry,
} from './teacherTimetable'
import {
  classIdsForTeacherInYear,
  classNameToId,
  gradeNumberFromClassName,
  teacherWhitelistForYear,
} from './teacherWhitelist'

export type CampusSubject = 'CHIN' | 'EC' | 'CHIS' | 'PTH'

export const CAMPUS_SUBJECT_OPTIONS: {
  id: CampusSubject
  label: string
}[] = [
  { id: 'CHIN', label: '中文' },
  { id: 'EC', label: 'EC' },
  { id: 'CHIS', label: '中史' },
  { id: 'PTH', label: 'PTH' },
]

export function isEcClassName(name: string): boolean {
  return /^G\d+\s*EC$/i.test(name.trim())
}

function subjectKind(subject: string): CampusSubject | 'OTHER' {
  const s = subject.trim().toUpperCase()
  if (s.startsWith('CHIN')) return 'CHIN'
  if (s === 'CHIS') return 'CHIS'
  if (s === 'PTH') return 'PTH'
  if (s === 'EC') return 'EC'
  return 'OTHER'
}

/** Timetable code G7D / G9 EC → roster class name 7D / G9 EC. */
export function timetableCodeToClassName(code: string): string | null {
  const ec = code.match(/^G(\d+)\s*EC$/i)
  if (ec) return `G${ec[1]} EC`
  const form = code.match(/^G(\d+)([A-Z]+)$/i)
  if (form) return `${form[1]}${form[2].toUpperCase()}`
  return null
}

function classIdsFromCodes(
  codes: Iterable<string>,
  classes: SchoolClass[],
): string[] {
  const nameToId = new Map(classes.map((c) => [c.name, c.id]))
  const ids = new Set<string>()
  for (const code of codes) {
    const name = timetableCodeToClassName(code)
    if (!name) continue
    const id = nameToId.get(name)
    if (id) ids.add(id)
  }
  return [...ids]
}

function classCodesFromTimetable(
  teacherId: string,
  subject: CampusSubject,
  startYear: number,
): string[] {
  const entry = teacherTimetableEntry(teacherId, startYear)
  if (!entry) return []
  const codes = new Set<string>()
  for (let day = 1; day <= 5; day++) {
    for (const period of entry.weekly[day as 1 | 2 | 3 | 4 | 5]) {
      if (period.type !== 'lesson') continue
      if (subjectKind(period.subject) !== subject) continue
      for (const token of splitGroupTokens(period.group)) {
        const code = normalizeClassCode(token)
        if (code) codes.add(code)
      }
    }
  }
  return [...codes]
}

function classCodesFromAllTimetables(
  subject: CampusSubject,
  startYear: number,
): string[] {
  const codes = new Set<string>()
  for (const teacher of teacherWhitelistForYear(startYear)) {
    const teacherId = `u-${teacher.initial.toLowerCase()}`
    for (const code of classCodesFromTimetable(teacherId, subject, startYear)) {
      codes.add(code)
    }
  }
  return [...codes]
}

export function subjectsFromTimetable(
  teacherId: string,
  startYear: number,
): CampusSubject[] {
  const found = new Set<CampusSubject>()
  for (let day = 1; day <= 5; day++) {
    const entry = teacherTimetableEntry(teacherId, startYear)
    if (!entry) continue
    for (const period of entry.weekly[day as 1 | 2 | 3 | 4 | 5]) {
      if (period.type !== 'lesson') continue
      const kind = subjectKind(period.subject)
      if (kind !== 'OTHER') found.add(kind)
    }
  }
  return CAMPUS_SUBJECT_OPTIONS.map((o) => o.id).filter((id) => found.has(id))
}

function isCampusSubject(value: string): value is CampusSubject {
  return CAMPUS_SUBJECT_OPTIONS.some((o) => o.id === value)
}

export function normalizeSelectedSubjects(
  subjects: Iterable<CampusSubject>,
): CampusSubject[] {
  const set = new Set(subjects)
  return CAMPUS_SUBJECT_OPTIONS.map((o) => o.id).filter((id) => set.has(id))
}

export function classIdsForSubjects(
  subjects: CampusSubject[],
  user: User,
  accessibleClasses: SchoolClass[],
  allClasses: SchoolClass[],
  startYear: number,
): string[] {
  const ids = new Set<string>()
  for (const subject of normalizeSelectedSubjects(subjects)) {
    for (const id of classIdsForSubject(
      subject,
      user,
      accessibleClasses,
      allClasses,
      startYear,
    )) {
      ids.add(id)
    }
  }
  return [...ids]
}

/** Grade levels the user teaches for one subject (timetable + whitelist fallback). */
export function gradeNumbersForSubject(
  user: User,
  subject: CampusSubject,
  accessibleClasses: SchoolClass[],
  allClasses: SchoolClass[],
  startYear: number,
): number[] {
  const ids = classIdsForSubject(
    subject,
    user,
    accessibleClasses,
    allClasses,
    startYear,
  )
  const grades = new Set<number>()
  for (const id of ids) {
    const cls = allClasses.find((c) => c.id === id)
    if (!cls) continue
    const g = gradeNumberFromClassName(cls.name)
    if (g != null) grades.add(g)
  }
  return [...grades].sort((a, b) => a - b)
}

/** Whether a signed-in user should see a grade-scoped calendar audience. */
export function calendarGradeAudienceMatchesUser(
  audience: Extract<CalendarAudience, { type: 'grades' }>,
  user: User,
  ctx: {
    accessibleClasses: SchoolClass[]
    allClasses: SchoolClass[]
    selectedSubjects: CampusSubject[]
    scoresAcademicYearStart: number
  },
): boolean {
  const eventSubjects = audience.subjects?.length
    ? normalizeSelectedSubjects(audience.subjects)
    : CAMPUS_SUBJECT_OPTIONS.map((o) => o.id)
  const visibleSubjects = eventSubjects.filter((s) =>
    ctx.selectedSubjects.includes(s),
  )
  if (visibleSubjects.length === 0) return false

  for (const subject of visibleSubjects) {
    const taught = gradeNumbersForSubject(
      user,
      subject,
      ctx.accessibleClasses,
      ctx.allClasses,
      ctx.scoresAcademicYearStart,
    )
    if (audience.grades.some((g) => taught.includes(g))) return true
  }
  return false
}

export function classIdsForSubject(
  subject: CampusSubject,
  user: User,
  accessibleClasses: SchoolClass[],
  allClasses: SchoolClass[],
  startYear: number,
): string[] {
  const accessibleIds = new Set(accessibleClasses.map((c) => c.id))

  if (user.role === 'admin') {
    if (subject === 'CHIN') {
      return allClasses.filter((c) => !isEcClassName(c.name)).map((c) => c.id)
    }
    if (subject === 'EC') {
      return allClasses.filter((c) => isEcClassName(c.name)).map((c) => c.id)
    }
    return classIdsFromCodes(
      classCodesFromAllTimetables(subject, startYear),
      allClasses,
    )
  }

  let ids = classIdsFromCodes(
    classCodesFromTimetable(user.id, subject, startYear),
    allClasses,
  )

  if (ids.length === 0) {
    if (subject === 'CHIN') {
      ids = accessibleClasses
        .filter((c) => !isEcClassName(c.name))
        .map((c) => c.id)
    } else if (subject === 'EC') {
      ids = accessibleClasses
        .filter((c) => isEcClassName(c.name))
        .map((c) => c.id)
    }
  }

  return ids.filter((id) => accessibleIds.has(id))
}

function teacherHasEcAssignment(user: User, startYear: number): boolean {
  const ids = classIdsForTeacherInYear(user.id, startYear)
  if (ids.some((id) => /-ec$/i.test(id))) return true
  return user.classIds.some((id) => /-ec$/i.test(id))
}

export function subjectsForUser(
  user: User | null,
  accessibleClasses: SchoolClass[],
  _allClasses: SchoolClass[],
  startYear: number,
): CampusSubject[] {
  if (!user) return []

  if (user.role === 'admin') {
    return CAMPUS_SUBJECT_OPTIONS.map((o) => o.id)
  }

  const fromTimetable = subjectsFromTimetable(user.id, startYear)
  const merged = new Set<CampusSubject>(fromTimetable)

  if (accessibleClasses.some((c) => !isEcClassName(c.name))) {
    merged.add('CHIN')
  }
  if (
    accessibleClasses.some((c) => isEcClassName(c.name)) ||
    teacherHasEcAssignment(user, startYear) ||
    fromTimetable.includes('EC')
  ) {
    merged.add('EC')
  }

  return CAMPUS_SUBJECT_OPTIONS.map((o) => o.id).filter((id) => merged.has(id))
}

/** Whitelist class name → id (for tests / helpers). */
export function classIdFromName(name: string): string {
  return classNameToId(name)
}

export { isCampusSubject }
