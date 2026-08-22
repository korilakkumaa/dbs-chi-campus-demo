import {
  formClassLetterRank,
  teacherWhitelist,
} from './teacherWhitelist'
import { formatAcademicYearLabel, academicYearStartFromIso } from './academicYear'
import { isoDateLocal } from './calendarEvents'
import {
  TEACHER_WEEKLY_TIMETABLES,
  type SchoolWeekday,
} from './teacherTimetable'

/** Standard teaching slots (excludes assembly / recess / lunch / dismissal). */
export const LESSON_SLOTS = [
  { start: '08:30', end: '09:15' },
  { start: '09:15', end: '10:00' },
  { start: '10:20', end: '11:05' },
  { start: '11:05', end: '11:50' },
  { start: '11:50', end: '12:35' },
  { start: '14:00', end: '14:45' },
  { start: '14:45', end: '15:30' },
] as const

export type LessonSlot = (typeof LESSON_SLOTS)[number]

export type GradeLevel = 7 | 8 | 9 | 10 | 11 | 12

export type GradeChineseLesson = {
  teacherId: string
  teacherInitial: string
  teacherName: string
  day: SchoolWeekday
  start: string
  end: string
  subject: string
  group: string
  room: string
  /** Normalized class codes belonging to this grade within the group. */
  classes: string[]
}

export type GradeSlotCell = {
  day: SchoolWeekday
  start: string
  end: string
  lessons: GradeChineseLesson[]
  /**
   * True when every teacher who teaches Chinese (CHIN*) for this grade
   * has a personal free period (`type: 'free'`) in this slot.
   * EC-only teachers for the grade are not required to attend.
   */
  isCommonFree: boolean
}

export type GradeClassTeacherPair = {
  classCode: string
  teacherId: string | null
  teacherInitial: string | null
  teacherName: string | null
}

const WEEKDAYS: SchoolWeekday[] = [1, 2, 3, 4, 5]

const TEACHER_META = Object.fromEntries(
  teacherWhitelist.map((t) => [
    `u-${t.initial.toLowerCase()}`,
    { initial: t.initial, name: t.name },
  ]),
)

/** Chinese / EC subjects shown on the grade distribution grid (excludes PTH & CHIS). */
export function isChineseSubject(subject: string): boolean {
  const s = subject.trim().toUpperCase()
  return s.startsWith('CHIN') || s === 'EC'
}

/** Core Chinese lessons that count toward 共同空堂 teacher attendance. */
export function isChinSubject(subject: string): boolean {
  return subject.trim().toUpperCase().startsWith('CHIN')
}

export function splitGroupTokens(group: string): string[] {
  return group
    .split(/[,/]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Normalize timetable group tokens → G7A / G9 EC style. */
export function normalizeClassCode(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim()
  const ec = t.match(/^G?\s*(7|8|9|10|11|12)\s*EC$/i)
  if (ec) return `G${ec[1]} EC`

  const form = t.match(/^G?\s*(7|8|9|10|11|12)\s*([A-Z]+)$/i)
  if (form) return `G${form[1]}${form[2].toUpperCase()}`

  return null
}

/** Whitelist names like `7D` / `G9 EC` → timetable class codes. */
export function whitelistClassToCode(name: string): string | null {
  return normalizeClassCode(name)
}

export function gradeFromClassCode(code: string): GradeLevel | null {
  const m = code.match(/^G(12|11|10|[789])/)
  if (!m) return null
  return Number(m[1]) as GradeLevel
}

function shortClassLabel(code: string): string {
  const ec = code.match(/^G(\d+)\s*EC$/i)
  if (ec) return `${ec[1]}EC`
  const form = code.match(/^G(\d+)([A-Z]+)$/i)
  if (form) return `${form[1]}${form[2]}`
  return code
}

export function classDisplayLabel(code: string): string {
  return shortClassLabel(code)
}

function teacherMeta(teacherId: string) {
  return (
    TEACHER_META[teacherId] ?? {
      initial: teacherId.replace(/^u-/i, '').toUpperCase(),
      name: teacherId,
    }
  )
}

function collectGradeLessons(grade: GradeLevel): GradeChineseLesson[] {
  const out: GradeChineseLesson[] = []

  for (const [teacherId, entry] of Object.entries(TEACHER_WEEKLY_TIMETABLES)) {
    const meta = teacherMeta(teacherId)

    for (const day of WEEKDAYS) {
      for (const period of entry.weekly[day]) {
        if (period.type !== 'lesson') continue
        if (!isChineseSubject(period.subject)) continue

        const classes = splitGroupTokens(period.group)
          .map(normalizeClassCode)
          .filter((c): c is string => c != null && gradeFromClassCode(c) === grade)

        if (classes.length === 0) continue

        out.push({
          teacherId,
          teacherInitial: meta.initial,
          teacherName: meta.name,
          day,
          start: period.start,
          end: period.end,
          subject: period.subject,
          group: period.group,
          room: period.room,
          classes: [...new Set(classes)].sort(compareClassCodes),
        })
      }
    }
  }

  return out
}

export function compareClassCodes(a: string, b: string): number {
  const rank = (code: string) => {
    const ec = code.match(/^G(\d+)\s*EC$/i)
    if (ec) return { g: Number(ec[1]), form: 10_000, ec: 1 }
    const form = code.match(/^G(\d+)([A-Z]+)$/i)
    if (form) {
      return {
        g: Number(form[1]),
        form: formClassLetterRank(form[2]),
        ec: 0,
      }
    }
    return { g: 99, form: 20_000, ec: 0 }
  }
  const ra = rank(a)
  const rb = rank(b)
  return ra.g - rb.g || ra.ec - rb.ec || ra.form - rb.form || a.localeCompare(b)
}

function chinTeacherForClass(
  classCode: string,
  lessons: GradeChineseLesson[],
): { teacherId: string; initial: string; name: string } | null {
  const fromWhitelist = teacherWhitelist.find((t) =>
    t.classes.some((c) => whitelistClassToCode(c) === classCode),
  )
  if (fromWhitelist) {
    return {
      teacherId: `u-${fromWhitelist.initial.toLowerCase()}`,
      initial: fromWhitelist.initial,
      name: fromWhitelist.name,
    }
  }

  const chin = lessons.find(
    (l) => isChinSubject(l.subject) && l.classes.includes(classCode),
  )
  if (chin) {
    return {
      teacherId: chin.teacherId,
      initial: chin.teacherInitial,
      name: chin.teacherName,
    }
  }

  const any = lessons.find((l) => l.classes.includes(classCode))
  if (any) {
    return {
      teacherId: any.teacherId,
      initial: any.teacherInitial,
      name: any.teacherName,
    }
  }
  return null
}

/**
 * Form classes for this grade (school letter order) paired with their
 * Chinese teacher — same index in both summary rows.
 */
export function listGradeClassTeacherPairs(
  grade: GradeLevel,
): GradeClassTeacherPair[] {
  const lessons = collectGradeLessons(grade)
  const classes = listGradeClasses(grade)
  return classes.map((classCode) => {
    const teacher = chinTeacherForClass(classCode, lessons)
    return {
      classCode,
      teacherId: teacher?.teacherId ?? null,
      teacherInitial: teacher?.initial ?? null,
      teacherName: teacher?.name ?? null,
    }
  })
}

/**
 * Teachers who must be free for 共同空堂:
 * anyone with a CHIN* lesson for this grade. EC-only teachers are excluded.
 * Ordered by first paired form class (school letter order).
 */
export function listGradeCommonFreeTeachers(grade: GradeLevel): {
  teacherId: string
  initial: string
  name: string
}[] {
  const pairs = listGradeClassTeacherPairs(grade)
  const chinTeacherIds = new Set(
    collectGradeLessons(grade)
      .filter((l) => isChinSubject(l.subject))
      .map((l) => l.teacherId),
  )
  const seen = new Set<string>()
  const ordered: { teacherId: string; initial: string; name: string }[] = []

  for (const pair of pairs) {
    if (!pair.teacherId || !pair.teacherInitial || !pair.teacherName) continue
    if (!chinTeacherIds.has(pair.teacherId)) continue
    if (seen.has(pair.teacherId)) continue
    seen.add(pair.teacherId)
    ordered.push({
      teacherId: pair.teacherId,
      initial: pair.teacherInitial,
      name: pair.teacherName,
    })
  }

  for (const teacherId of chinTeacherIds) {
    if (seen.has(teacherId)) continue
    const meta = teacherMeta(teacherId)
    ordered.push({
      teacherId,
      initial: meta.initial,
      name: meta.name,
    })
  }

  return ordered
}

function isTeacherFreeAt(
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

export function listGradeClasses(grade: GradeLevel): string[] {
  const set = new Set<string>()
  for (const lesson of collectGradeLessons(grade)) {
    for (const c of lesson.classes) set.add(c)
  }
  return [...set].sort(compareClassCodes)
}

export function getGradeSlotGrid(grade: GradeLevel): GradeSlotCell[] {
  const lessons = collectGradeLessons(grade)
  const commonFreeTeachers = listGradeCommonFreeTeachers(grade).map(
    (t) => t.teacherId,
  )
  const cells: GradeSlotCell[] = []

  for (const day of WEEKDAYS) {
    for (const slot of LESSON_SLOTS) {
      const slotLessons = lessons
        .filter(
          (l) => l.day === day && l.start === slot.start && l.end === slot.end,
        )
        .sort((a, b) => {
          const ca = a.classes[0] ?? a.group
          const cb = b.classes[0] ?? b.group
          return (
            compareClassCodes(ca, cb) ||
            a.teacherInitial.localeCompare(b.teacherInitial)
          )
        })
      const isCommonFree =
        commonFreeTeachers.length > 0 &&
        commonFreeTeachers.every((teacherId) =>
          isTeacherFreeAt(teacherId, day, slot.start, slot.end),
        )

      cells.push({
        day,
        start: slot.start,
        end: slot.end,
        lessons: slotLessons,
        isCommonFree,
      })
    }
  }

  return cells
}

export function listCommonFreeSlots(grade: GradeLevel): GradeSlotCell[] {
  return getGradeSlotGrid(grade).filter((c) => c.isCommonFree)
}

export function academicYearLabelForGradeTimetable(): string {
  return formatAcademicYearLabel(academicYearStartFromIso(isoDateLocal()))
}
