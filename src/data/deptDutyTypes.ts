export type DeptDutyRole = 'leader' | 'member'

export type DeptDutyPerson = {
  code: string
  name: string
  note?: string
}

export type DeptDutyMemberGroup = {
  label: string
  people: DeptDutyPerson[]
}

export type DeptDutyItem = {
  id: number
  title: string
  leaders: DeptDutyPerson[]
  members: DeptDutyPerson[]
  membersAll?: boolean
  memberGroups?: DeptDutyMemberGroup[]
}

export type TeacherDeptDutyLine = {
  itemId: number
  title: string
  role?: DeptDutyRole
  note?: string
}

export type TeacherDeptDuty = {
  code: string
  name: string
  title?: string
  lines: TeacherDeptDutyLine[]
}

export type DeptDutyYear = {
  startYear: number
  label: string
  source: string
  items: DeptDutyItem[]
  teachers: TeacherDeptDuty[]
}
