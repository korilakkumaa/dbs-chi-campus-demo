import type { SchoolClass } from '../types'
import { CAMPUS_SCORES_ACADEMIC_YEAR_START } from './campusScoresYear'

export interface WhitelistTeacher {
  initial: string
  name: string
  email: string
  classes: string[]
}

/** 2025/26 — from teacher-whitelist-2526.csv (matches score import & teaching_group). */
export const TEACHER_WHITELIST_2526: WhitelistTeacher[] = [
  { initial: 'FYC', name: '朱鳳儀', email: 'dbsfyc@dbs.edu.hk', classes: ['7D', '7L', '12S'] },
  { initial: 'LKL', name: '林麗君', email: 'dbslkl@dbs.edu.hk', classes: ['7S', '10G'] },
  { initial: 'YLN', name: '吳綺琳', email: 'dbsyln@dbs.edu.hk', classes: ['7P', '7A', '11L'] },
  { initial: 'HNY', name: '袁軒妮', email: 'dbshny@dbs.edu.hk', classes: ['7T', '11J'] },
  { initial: 'WWC', name: '鍾慧樺', email: 'dbswwc@dbs.edu.hk', classes: ['8J', 'G8 EC', 'G9 EC', '12T'] },
  { initial: 'LWW', name: '胡麗華', email: 'dbslww@dbs.edu.hk', classes: ['7M', '10S', '11P'] },
  { initial: 'LWT', name: '曾麗雲', email: 'dbslwt@dbs.edu.hk', classes: ['7R', '7G', '10M'] },
  { initial: 'WKL', name: '王家朗', email: 'dbswkl@dbs.edu.hk', classes: ['G7 EC', 'G9 EC', '9A', '11T'] },
  { initial: 'TWL', name: '梁芷蘊', email: 'dbstwl@dbs.edu.hk', classes: ['8S', '11D', '12J'] },
  { initial: 'LL', name: '李寶玲', email: 'dbsll@dbs.edu.hk', classes: ['8D', '10T', '12M'] },
  { initial: 'YWL', name: '賴耀榮', email: 'dbsywl@dbs.edu.hk', classes: ['8G', '8L', '9R'] },
  { initial: 'CHUC', name: '陳振翔', email: 'dbschuc@dbs.edu.hk', classes: ['8P', '8A', '10A'] },
  { initial: 'TCM', name: '馬太初', email: 'dbstcm@dbs.edu.hk', classes: ['8M'] },
  { initial: 'YCN', name: '吳燕青', email: 'dbsycn@dbs.edu.hk', classes: ['8R', '9M', '9J'] },
  { initial: 'KSM', name: '陳詩敏', email: 'dbsksm@dbs.edu.hk', classes: ['8T', 'IBEC', '11M', '12L'] },
  { initial: 'SHC', name: '周倩嫻', email: 'dbsshc@dbs.edu.hk', classes: ['9T', '10J', '12P'] },
  { initial: 'CC', name: '鄭媛媛', email: 'dbscc@dbs.edu.hk', classes: ['9D', '11P'] },
  { initial: 'MYI', name: '葉銘欣', email: 'dbsmyi@dbs.edu.hk', classes: ['9S', '10D', '11S'] },
  { initial: 'SMC', name: '朱小萌', email: 'dbssmc@dbs.edu.hk', classes: ['9P', '10P', '12G'] },
  { initial: 'HKC', name: '陳曉君', email: 'dbshkc@dbs.edu.hk', classes: ['9G', '9L', '11G'] },
  { initial: 'KIC', name: '朱麒穎', email: 'dbskic@dbs.edu.hk', classes: ['7J', '10L'] },
  { initial: 'HT', name: '盧曉彤', email: 'dbsht@dbs.edu.hk', classes: [] },
]

/** 2026/27 — from teacher-whitelist-2627.csv (timetables / next year only). */
export const TEACHER_WHITELIST_2627: WhitelistTeacher[] = [
  { initial: 'FYC', name: '朱鳳儀', email: 'dbsfyc@dbs.edu.hk', classes: ['7D', '7J', '10S'] },
  { initial: 'LKL', name: '林麗君', email: 'dbslkl@dbs.edu.hk', classes: ['7S', '11G'] },
  { initial: 'YLN', name: '吳綺琳', email: 'dbsyln@dbs.edu.hk', classes: ['7G', '7L', 'G9 EC', '12L'] },
  { initial: 'HNY', name: '袁軒妮', email: 'dbshny@dbs.edu.hk', classes: ['7P', '12J'] },
  { initial: 'THW', name: '黃子軒', email: 'dbsthw@dbs.edu.hk', classes: ['7M', '9M', '9R'] },
  { initial: 'LWW', name: '胡麗華', email: 'dbslww@dbs.edu.hk', classes: ['7A', 'G8 EC', '11S', '12P'] },
  { initial: 'LWT', name: '曾麗雲', email: 'dbslwt@dbs.edu.hk', classes: ['7R', '7T', '11M'] },
  { initial: 'WKL', name: '王家朗', email: 'dbswkl@dbs.edu.hk', classes: ['G7 EC', 'G9 EC', 'G10 EC', '12T'] },
  { initial: 'TWL', name: '梁芷蘊', email: 'dbstwl@dbs.edu.hk', classes: ['8D', '10D', '12D'] },
  { initial: 'LL', name: '李寶玲', email: 'dbsll@dbs.edu.hk', classes: ['8S', '8L', '11T'] },
  { initial: 'KYL', name: '黎嘉恩', email: 'dbskyl@dbs.edu.hk', classes: ['8G', '8R', '10L'] },
  { initial: 'CHUC', name: '陳振翔', email: 'dbschuc@dbs.edu.hk', classes: ['8P', '8M', '11A'] },
  { initial: 'TCM', name: '馬太初', email: 'dbstcm@dbs.edu.hk', classes: ['8A'] },
  { initial: 'YCN', name: '吳燕青', email: 'dbsycn@dbs.edu.hk', classes: ['8J', '9A', '10A'] },
  { initial: 'KSM', name: '陳詩敏', email: 'dbsksm@dbs.edu.hk', classes: ['8T', 'G9 EC', '10J', '12M'] },
  { initial: 'SHC', name: '周倩嫻', email: 'dbsshc@dbs.edu.hk', classes: ['G8 EC', '9T', '10G', '11J'] },
  { initial: 'CC', name: '鄭媛媛', email: 'dbscc@dbs.edu.hk', classes: ['9D', '10P'] },
  { initial: 'MYI', name: '葉銘欣', email: 'dbsmyi@dbs.edu.hk', classes: ['9S', '11D', '12S'] },
  { initial: 'SMC', name: '朱小萌', email: 'dbssmc@dbs.edu.hk', classes: ['9G', '10M', '11P'] },
  { initial: 'HKC', name: '陳曉君', email: 'dbshkc@dbs.edu.hk', classes: ['9P', '9L', '12G'] },
  { initial: 'KIC', name: '朱麒穎', email: 'dbskic@dbs.edu.hk', classes: ['9J', '10T', '11L'] },
  { initial: 'HT', name: '盧曉彤', email: 'dbsht@dbs.edu.hk', classes: [] },
]

const WHITELIST_BY_YEAR: Record<number, WhitelistTeacher[]> = {
  2025: TEACHER_WHITELIST_2526,
  2026: TEACHER_WHITELIST_2627,
}

export function teacherWhitelistYears(): number[] {
  return Object.keys(WHITELIST_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b)
}

export function hasTeacherWhitelistYear(startYear: number): boolean {
  return Object.prototype.hasOwnProperty.call(WHITELIST_BY_YEAR, startYear)
}

/** Chinese-teaching whitelist for `startYear` only — never fall back to another year. */
export function teacherWhitelistForYear(startYear: number): WhitelistTeacher[] {
  return WHITELIST_BY_YEAR[startYear] ?? []
}

/** Newest imported teacher whitelist year (currently 2026/27). */
export function latestTeacherWhitelistYear(): number {
  return Math.max(...teacherWhitelistYears())
}

export function findWhitelistTeacherByEmail(
  email: string,
  startYear: number = latestTeacherWhitelistYear(),
): WhitelistTeacher | undefined {
  const needle = email.trim().toLowerCase()
  if (!needle) return undefined
  return teacherWhitelistForYear(startYear).find(
    (t) => t.email.toLowerCase() === needle,
  )
}

/** Default whitelist — aligned with campus scores (2025/26). */
export const teacherWhitelist = teacherWhitelistForYear(
  CAMPUS_SCORES_ACADEMIC_YEAR_START,
)

export function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

export function teacherUserIdFromInitial(initial: string): string {
  return `u-${initial.toLowerCase()}`
}

/** Teacher user id (u-fyc) → whitelist initial (FYC). */
export function teacherInitialFromUserId(userId: string): string | null {
  const raw = userId.replace(/^u-/i, '').trim()
  if (!raw || raw === 'admin' || raw === 'student') return null
  return raw.toUpperCase()
}

/** Class ids a teacher teaches in the given academic year (from whitelist). */
export function classIdsForTeacherInYear(
  teacherId: string,
  startYear: number,
): string[] {
  const initial = teacherInitialFromUserId(teacherId)
  if (!initial) return []
  const entry = teacherWhitelistForYear(startYear).find(
    (t) => t.initial === initial,
  )
  return entry?.classes.map(classNameToId) ?? []
}

/**
 * Classes a teacher taught in `startYear`, drawn from that year's whitelist.
 * Extra names (e.g. next-year codes not in the catalog) are appended so
 * timetable / calendar filters can still match by id.
 */
export function accessibleClassesForTeacherYear(
  teacher: { id: string; username: string },
  catalog: SchoolClass[],
  startYear: number,
): SchoolClass[] {
  const entry = findWhitelistTeacherByEmail(teacher.username, startYear)
  const yearClassIds = new Set(
    entry?.classes.map(classNameToId) ??
      classIdsForTeacherInYear(teacher.id, startYear),
  )
  const existing = catalog.filter((c) => yearClassIds.has(c.id))
  const have = new Set(existing.map((c) => c.id))
  const extras: SchoolClass[] = []
  for (const name of entry?.classes ?? []) {
    const id = classNameToId(name)
    if (have.has(id)) continue
    const gradeNum = gradeNumberFromClassName(name)
    extras.push({
      id,
      name,
      grade: gradeNum != null ? gradeLabel(gradeNum) : '其他',
      teacherId: null,
    })
  }
  return extras.length > 0 ? [...existing, ...extras] : existing
}

export function parseClassMeta(name: string): { grade: string; kind: 'form' | 'ec' } {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) {
    const n = Number(ec[1])
    return { grade: gradeLabel(n), kind: 'ec' }
  }
  const rSplit = name.match(/^(\d+)R_[A-Z]$/i)
  if (rSplit) {
    return { grade: gradeLabel(Number(rSplit[1])), kind: 'form' }
  }
  const form = name.match(/^(\d+)([A-Z])$/i)
  if (form) {
    return { grade: gradeLabel(Number(form[1])), kind: 'form' }
  }
  return { grade: '其他', kind: 'form' }
}

export function gradeLabel(grade: number): string {
  return `G${grade}`
}

export function gradeNumberFromClassName(name: string): number | null {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

export const GRADE_LEVELS = [7, 8, 9, 10, 11, 12] as const

/** Enrichment Chinese classes (G7–G10). */
export const EC_CLASS_NAMES = ['G7 EC', 'G8 EC', 'G9 EC', 'G10 EC'] as const

export function ecClassNameForGrade(grade: number): string {
  return `G${grade} EC`
}

/** EC teaching_group for a grade, e.g. G7 EC-WKL (2627). Null if no EC class that year. */
export function ecTeachingGroupForGrade(
  grade: number,
  academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): string | null {
  const ecClass = ecClassNameForGrade(grade)
  const teacher = teacherWhitelistForYear(academicYearStart).find((t) =>
    t.classes.includes(ecClass),
  )
  return teacher ? `${ecClass}-${teacher.initial}` : null
}

export function gradeNumberFromClassId(classId: string): number | null {
  const raw = classId.replace(/^c-/, '').replace(/-/g, ' ')
  const ec = raw.match(/^g(\d+)\s*ec$/i)
  if (ec) return Number(ec[1])
  const form = raw.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

/**
 * Junior form-class order (G7–G9): A is a normal form class; R is 補底班.
 */
export const JUNIOR_FORM_CLASS_ORDER = [
  'D',
  'S',
  'G',
  'P',
  'M',
  'L',
  'A',
  'R',
  'J',
  'T',
] as const

/** Senior admin form classes (G10–G12): nine classes, no mid-stream A. */
export const SENIOR_FORM_CLASS_ORDER = [
  'D',
  'S',
  'G',
  'P',
  'M',
  'L',
  'J',
  'T',
] as const

/**
 * Trailing A form class after T (e.g. 10A in 2526; 10A + 11A in 2627).
 * Full 行政班 — roster by class_id and/or teaching_group (10A-CHUC, …).
 */
export function hasTrailingAClass(
  grade: number,
  academicYearStart: number,
): boolean {
  if (grade === 10) return true
  if (grade === 11 && academicYearStart >= 2026) return true
  return false
}

export function isTrailingAFormClass(
  className: string,
  academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): boolean {
  const m = className.match(/^(\d+)A$/i)
  if (!m) return false
  return hasTrailingAClass(Number(m[1]), academicYearStart)
}

export function formClassLettersForGrade(
  grade: number,
  academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): readonly string[] {
  if (grade >= 10) {
    const letters: string[] = [...SENIOR_FORM_CLASS_ORDER]
    if (hasTrailingAClass(grade, academicYearStart)) letters.push('A')
    return letters
  }
  return JUNIOR_FORM_CLASS_ORDER
}

export function formClassLetterRank(
  letter: string,
  grade?: number,
  academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): number {
  const L = letter.toUpperCase()
  if (grade != null && grade >= 10) {
    const seniorIdx = SENIOR_FORM_CLASS_ORDER.indexOf(
      L as (typeof SENIOR_FORM_CLASS_ORDER)[number],
    )
    if (seniorIdx >= 0) return seniorIdx
    if (L === 'A' && hasTrailingAClass(grade, academicYearStart)) {
      return SENIOR_FORM_CLASS_ORDER.length
    }
    return SENIOR_FORM_CLASS_ORDER.length + 10 + L.charCodeAt(0)
  }
  const juniorIdx = JUNIOR_FORM_CLASS_ORDER.indexOf(
    L as (typeof JUNIOR_FORM_CLASS_ORDER)[number],
  )
  return juniorIdx === -1
    ? JUNIOR_FORM_CLASS_ORDER.length + L.charCodeAt(0)
    : juniorIdx
}

/** True for form classes like 7R–9R (Chinese remedial / 補底班). */
export function isRemedialFormClass(name: string): boolean {
  return /^(\d+)R(_[A-Z])?$/i.test(name)
}

/** R-class subtitle for class cards (e.g. 7R → 補底班 · 7A、7L). */
export function remedialClassNote(
  name: string,
  _academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): string | null {
  const split = name.match(/^(\d+)R_([A-Z])$/i)
  if (split) return `補底班 · ${split[2].toUpperCase()}組`
  const m = name.match(/^(\d+)R$/i)
  if (m) return `補底班 · ${m[1]}A、${m[1]}L`
  return null
}

/** G7 EC / G8 EC … enrichment Chinese class. */
export function isEcFormClassName(name: string): boolean {
  return /^G\d+\s*EC$/i.test(name.trim())
}

function teachingGroupPrefix(teachingGroup: string | undefined): string {
  if (!teachingGroup) return ''
  const raw = teachingGroup.split('-')[0]?.trim().toUpperCase() ?? ''
  if (!raw || raw === '#N/A') return ''
  return raw.replace(/\s+/g, ' ')
}

/** French stream — roster flag or Group prefix like 7FR. FR assigned to G{n} EC counts as EC. */
export function isFrenchStreamStudent(s: {
  french?: boolean
  teachingGroup?: string
}): boolean {
  if (isEcStreamStudent(s)) return false
  if (s.french) return true
  const prefix = teachingGroupPrefix(s.teachingGroup)
  return /^\d+FR$/.test(prefix.replace(/\s+/g, ''))
}

/** EC / IBEC Chinese stream (Group prefix G7 EC, G10 EC, IBEC, …). */
export function isEcStreamStudent(s: { teachingGroup?: string }): boolean {
  const prefix = teachingGroupPrefix(s.teachingGroup)
  if (!prefix) return false
  if (prefix === 'IBEC') return true
  return /^G\d+EC$/.test(prefix.replace(/\s+/g, '')) || /^G\d+ EC$/.test(prefix)
}

/** Grade for G{n} EC stream; null for IBEC or unknown. */
export function ecStreamGrade(s: { teachingGroup?: string }): number | null {
  const prefix = teachingGroupPrefix(s.teachingGroup)
  const compact = prefix.replace(/\s+/g, '')
  let m = compact.match(/^G(\d+)EC$/)
  if (m) return Number(m[1])
  m = prefix.match(/^G(\d+) EC$/)
  if (m) return Number(m[1])
  m = compact.match(/^(\d+)EC$/)
  if (m) return Number(m[1])
  return null
}

type RosterStudent = {
  classId: string
  teachingGroup?: string
  french?: boolean
}

/**
 * G10+ Chinese groups (10G-LKL, …) often differ from the six admin form rolls
 * (10D, 10J, 10M, 10P, 10S, 10T). Match roster by teaching_group prefix only —
 * do not fall back to class_id (e.g. c-10g is the English 行政班, not 中文 10G).
 */
export function isSeniorChineseFormClass(
  className: string,
  grade: number | null,
): boolean {
  if (grade == null || grade < 10) return false
  if (isEcFormClassName(className)) return false
  return /^\d+[A-Z]$/i.test(className)
}

function rosterByTeachingGroupPrefix<T extends RosterStudent>(
  className: string,
  students: T[],
): T[] {
  const prefix = className.toUpperCase()
  return students.filter((s) => {
    if (isFrenchStreamStudent(s) || isEcStreamStudent(s)) return false
    const tg = s.teachingGroup?.toUpperCase().trim() ?? ''
    if (!tg || tg === '#N/A') return false
    return tg.startsWith(`${prefix}-`) || tg === prefix
  })
}

/**
 * Chinese-teaching roster:
 * - G7–G9: admin class_id; R / French / EC pull-outs by teaching_group or flags.
 * - G10–G12: teaching_group prefix (10G-…); admin roll is often 10D/10J/….
 */
export function rosterForChineseClass<T extends RosterStudent>(
  classId: string,
  className: string,
  students: T[],
  academicYearStart: number = CAMPUS_SCORES_ACADEMIC_YEAR_START,
): T[] {
  const grade = gradeNumberFromClassName(className)
  const letter = className.slice(-1).toUpperCase()

  if (isEcFormClassName(className) && grade != null) {
    return students.filter((s) => {
      if (ecStreamGrade(s) === grade) return true
      return (
        Boolean(s.french) &&
        gradeNumberFromClassId(s.classId) === grade &&
        ecTeachingGroupForGrade(grade, academicYearStart) != null
      )
    })
  }

  if (grade != null && letter === 'R' && grade < 10) {
    const prefix = `${grade}R`
    return students.filter((s) =>
      s.teachingGroup?.toUpperCase().startsWith(prefix),
    )
  }

  if (isSeniorChineseFormClass(className, grade) && grade != null) {
    if (
      letter === 'A' &&
      !hasTrailingAClass(grade, academicYearStart)
    ) {
      return []
    }
    return rosterByTeachingGroupPrefix(className, students)
  }

  return students.filter((s) => {
    if (s.classId !== classId) return false
    if (isFrenchStreamStudent(s) || isEcStreamStudent(s)) return false
    if (grade == null) return true
    const tg = s.teachingGroup?.toUpperCase() ?? ''
    if (
      (letter === 'A' || letter === 'L') &&
      tg.startsWith(`${grade}R`)
    ) {
      return false
    }
    return true
  })
}
