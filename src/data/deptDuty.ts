import { DEPT_DUTY_2627 } from './deptDuty2627'
import type { DeptDutyYear, TeacherDeptDuty } from './deptDutyTypes'
import { teacherWhitelistForYear } from './teacherWhitelist'

export type { DeptDutyYear, TeacherDeptDuty, DeptDutyItem, DeptDutyPerson } from './deptDutyTypes'

const BY_START_YEAR: Record<number, DeptDutyYear> = {
  2026: DEPT_DUTY_2627,
}

export function listDeptDutyYears(): number[] {
  return Object.keys(BY_START_YEAR)
    .map(Number)
    .sort((a, b) => b - a)
}

export function getDeptDuty(startYear: number): DeptDutyYear | null {
  return BY_START_YEAR[startYear] ?? null
}

export function deptDutyNameMap(duty: DeptDutyYear, startYear: number): Map<string, string> {
  const map = new Map<string, string>()
  for (const t of teacherWhitelistForYear(startYear)) {
    map.set(t.initial, t.name)
  }
  for (const t of duty.teachers) {
    map.set(t.code, t.name)
  }
  for (const item of duty.items) {
    for (const p of [...item.leaders, ...item.members]) {
      if (!map.has(p.code)) map.set(p.code, p.name)
    }
    for (const group of item.memberGroups ?? []) {
      for (const p of group.people) {
        if (!map.has(p.code)) map.set(p.code, p.name)
      }
    }
  }
  return map
}

export function resolveDeptDutyTeacher(
  userId: string | undefined,
  teachers: TeacherDeptDuty[],
): TeacherDeptDuty | null {
  if (!userId || userId === 'u-admin' || userId === 'u-student') return null
  const raw = userId.replace(/^u-/, '')
  const upper = raw.toUpperCase()
  return (
    teachers.find((t) => t.code === upper) ??
    teachers.find((t) => t.code.toLowerCase() === raw.toLowerCase()) ??
    null
  )
}

export function roleLabel(role: TeacherDeptDuty['lines'][number]['role']): string | null {
  if (role === 'leader') return '統籌'
  if (role === 'member') return '成員'
  return null
}

function roleRank(role: TeacherDeptDuty['lines'][number]['role']): number {
  if (role === 'leader') return 0
  if (role === 'member') return 1
  return 2
}

/** 統籌依項目編號，其後成員依項目編號。 */
export function sortTeacherDutyLines(
  lines: TeacherDeptDuty['lines'],
): TeacherDeptDuty['lines'] {
  return [...lines].sort((a, b) => {
    const role = roleRank(a.role) - roleRank(b.role)
    if (role !== 0) return role
    return a.itemId - b.itemId
  })
}
