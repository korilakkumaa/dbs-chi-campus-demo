import type { SchoolClass } from '../types'
import {
  classNameToId,
  EC_CLASS_NAMES,
  formClassLettersForGrade,
  GRADE_LEVELS,
  gradeLabel,
  gradeNumberFromClassName,
  teacherUserIdFromInitial,
  teacherWhitelistForYear,
} from './teacherWhitelist'

function classFromName(
  name: string,
  teacherId: string | null,
): SchoolClass {
  const gradeNum = gradeNumberFromClassName(name)
  return {
    id: classNameToId(name),
    name,
    grade: gradeNum != null ? gradeLabel(gradeNum) : '其他',
    teacherId,
  }
}

function teacherIdByClassName(academicYearStart: number): Map<string, string> {
  const map = new Map<string, string>()
  for (const teacher of teacherWhitelistForYear(academicYearStart)) {
    const teacherId = teacherUserIdFromInitial(teacher.initial)
    for (const className of teacher.classes) {
      if (!map.has(className)) map.set(className, teacherId)
    }
  }
  return map
}

/**
 * Chinese class catalog for an academic year.
 * Only that year's teacher whitelist is used — never another year's assignments.
 * Years without a whitelist start empty; the name-list roster fills form classes.
 */
export function buildSchoolClasses(academicYearStart: number): SchoolClass[] {
  const teachers = teacherWhitelistForYear(academicYearStart)
  if (teachers.length === 0) return []

  const teacherIdByName = teacherIdByClassName(academicYearStart)
  const names: string[] = []
  const seen = new Set<string>()
  const add = (name: string) => {
    if (seen.has(name)) return
    seen.add(name)
    names.push(name)
  }

  for (const grade of GRADE_LEVELS) {
    for (const letter of formClassLettersForGrade(grade, academicYearStart)) {
      add(`${grade}${letter}`)
    }
  }
  for (const name of EC_CLASS_NAMES) add(name)
  for (const teacher of teachers) {
    for (const name of teacher.classes) add(name)
  }

  return names.map((name) =>
    classFromName(name, teacherIdByName.get(name) ?? null),
  )
}

function classNameFromId(
  classId: string,
  nameById: Map<string, string>,
): string {
  const named = nameById.get(classId)
  if (named) return named
  const raw = classId.replace(/^c-/, '').replace(/-/g, ' ')
  const ec = raw.match(/^g(\d+)\s*ec$/i)
  if (ec) return `G${ec[1]} EC`
  if (/^\d+[a-z](?:_[a-z])?$/i.test(raw)) return raw.toUpperCase()
  return raw.toUpperCase()
}

function chinesePulloutClassNames(teachingGroup?: string): string[] {
  if (!teachingGroup) return []
  const prefix = teachingGroup.split('-')[0]?.trim().toUpperCase() ?? ''
  if (!prefix || prefix === '#N/A') return []
  const remedial = prefix.match(/^(\d+)R/)
  if (remedial) return [`${remedial[1]}R`]
  const compact = prefix.replace(/\s+/g, '')
  if (compact === 'IBEC') return ['IBEC']
  const ec = compact.match(/^G(\d+)EC$/)
  if (ec) return [`G${ec[1]} EC`]
  return []
}

/** Add this year's name-list form classes and Chinese pull-outs (R / EC). */
export function addClassesFromRoster(
  catalog: SchoolClass[],
  academicYearStart: number,
  students: { classId: string; teachingGroup?: string }[],
  nameById: Map<string, string>,
): SchoolClass[] {
  const teacherIdByName = teacherIdByClassName(academicYearStart)
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const ensure = (name: string) => {
    const id = classNameToId(name)
    if (byId.has(id)) return
    byId.set(id, classFromName(name, teacherIdByName.get(name) ?? null))
  }
  for (const student of students) {
    ensure(classNameFromId(student.classId, nameById))
    for (const name of chinesePulloutClassNames(student.teachingGroup)) {
      ensure(name)
    }
  }
  return [...byId.values()]
}

/** Overlay remote class names/teachers onto the year catalog; never add other-year extras. */
export function mergeRemoteClasses(
  catalog: SchoolClass[],
  remote: SchoolClass[],
): SchoolClass[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  for (const row of remote) {
    const existing = byId.get(row.id)
    if (!existing) continue
    byId.set(row.id, {
      ...existing,
      name: existing.name || row.name,
      teacherId: existing.teacherId ?? row.teacherId,
    })
  }
  return [...byId.values()]
}
