import type {
  DeptDutyItem,
  DeptDutyPerson,
  DeptDutyYear,
  TeacherDeptDuty,
  TeacherDeptDutyLine,
} from './deptDutyTypes'
import { teacherWhitelistForYear } from './teacherWhitelist'

function personKey(p: DeptDutyPerson): string {
  return `${p.code}::${p.note ?? ''}`
}

function collectPeople(item: DeptDutyItem): {
  leaders: DeptDutyPerson[]
  members: DeptDutyPerson[]
} {
  const leaders = item.leaders ?? []
  if (item.membersAll) {
    return { leaders, members: [] }
  }
  if (item.memberGroups?.length) {
    const members: DeptDutyPerson[] = []
    const seen = new Set(leaders.map(personKey))
    for (const group of item.memberGroups) {
      for (const p of group.people) {
        const key = personKey(p)
        if (seen.has(key)) continue
        seen.add(key)
        members.push(p)
      }
    }
    return { leaders, members }
  }
  return { leaders, members: item.members ?? [] }
}

/** Rebuild teachers[] from items + whitelist (single source of truth). */
export function deriveDeptTeachers(
  startYear: number,
  items: DeptDutyItem[],
  previousTeachers: TeacherDeptDuty[] = [],
): TeacherDeptDuty[] {
  const nameMap = new Map<string, string>()
  for (const t of teacherWhitelistForYear(startYear)) {
    nameMap.set(t.initial, t.name)
  }

  const titleByCode = new Map<string, string>()
  for (const t of previousTeachers) {
    if (t.title) titleByCode.set(t.code, t.title)
  }

  const linesByCode = new Map<string, TeacherDeptDutyLine[]>()
  const nameByCode = new Map<string, string>()

  for (const item of items) {
    const { leaders, members } = collectPeople(item)
    for (const p of leaders) {
      nameByCode.set(p.code, nameMap.get(p.code) ?? p.name)
      const lines = linesByCode.get(p.code) ?? []
      lines.push({
        itemId: item.id,
        title: item.title,
        role: 'leader',
        ...(p.note ? { note: p.note } : {}),
      })
      linesByCode.set(p.code, lines)
    }
    for (const p of members) {
      nameByCode.set(p.code, nameMap.get(p.code) ?? p.name)
      const lines = linesByCode.get(p.code) ?? []
      // Prefer leader role if already listed as leader on same item
      if (lines.some((l) => l.itemId === item.id && l.role === 'leader')) continue
      lines.push({
        itemId: item.id,
        title: item.title,
        role: 'member',
        ...(p.note ? { note: p.note } : {}),
      })
      linesByCode.set(p.code, lines)
    }
  }

  const teachers: TeacherDeptDuty[] = [...linesByCode.entries()].map(([code, lines]) => {
    const title = titleByCode.get(code)
    return {
      code,
      name: nameByCode.get(code) ?? nameMap.get(code) ?? code,
      ...(title ? { title } : {}),
      lines,
    }
  })

  teachers.sort((a, b) => a.code.localeCompare(b.code, 'en'))
  return teachers
}

export function withDerivedDeptTeachers(
  duty: Omit<DeptDutyYear, 'teachers'> & { teachers?: TeacherDeptDuty[] },
): DeptDutyYear {
  return {
    ...duty,
    teachers: deriveDeptTeachers(duty.startYear, duty.items, duty.teachers ?? []),
  }
}
