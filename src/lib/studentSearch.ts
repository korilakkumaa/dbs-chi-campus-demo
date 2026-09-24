import { officialStudentNo } from '../data/campusScoresYear'
import type { SchoolClass, Student } from '../types'

/** Match students by Chinese/English name, class, seat no, or student no. */
export function studentMatchesQuery(
  student: Student,
  query: string,
  className: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const compact = q.replace(/\s/g, '')
  const official = officialStudentNo(student.id).toLowerCase()
  const stored = student.id.toLowerCase()
  const nameEn = (student.nameEn ?? '').toLowerCase()
  const classLower = className.toLowerCase()
  const seat = String(student.classNumber)

  return (
    student.name.toLowerCase().includes(q) ||
    (nameEn.length > 0 && nameEn.includes(q)) ||
    classLower.includes(q) ||
    seat.includes(q) ||
    stored.includes(q) ||
    official.includes(q) ||
    `${classLower}${seat}`.includes(compact) ||
    `${classLower}${seat.padStart(2, '0')}`.includes(compact)
  )
}

export function filterStudentsByQuery(
  students: Student[],
  query: string,
  classes: Pick<SchoolClass, 'id' | 'name'>[],
): Student[] {
  const q = query.trim()
  if (!q) return students
  const classNameById = new Map(classes.map((c) => [c.id, c.name]))
  return students.filter((s) =>
    studentMatchesQuery(s, q, classNameById.get(s.classId) ?? ''),
  )
}
