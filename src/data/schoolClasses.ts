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

/** Official form / EC / whitelist classes for an academic year. */
export function buildSchoolClasses(academicYearStart: number): SchoolClass[] {
  const teachers = teacherWhitelistForYear(academicYearStart)
  const teacherIdByName = new Map<string, string>()
  for (const teacher of teachers) {
    const teacherId = teacherUserIdFromInitial(teacher.initial)
    for (const className of teacher.classes) {
      if (!teacherIdByName.has(className)) {
        teacherIdByName.set(className, teacherId)
      }
    }
  }

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

/** Overlay Supabase class rows onto the whitelist catalog; keep homeroom from catalog. */
export function mergeRemoteClasses(
  catalog: SchoolClass[],
  remote: SchoolClass[],
): SchoolClass[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  for (const row of remote) {
    const existing = byId.get(row.id)
    byId.set(row.id, {
      ...row,
      teacherId: existing?.teacherId ?? row.teacherId,
    })
  }
  return [...byId.values()]
}
