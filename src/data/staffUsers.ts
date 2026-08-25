import type { Role, User } from '../types'
import {
  classNameToId,
  teacherUserIdFromInitial,
  teacherWhitelistForYear,
  teacherWhitelistYears,
  type WhitelistTeacher,
} from './teacherWhitelist'

const STAFF_PASSWORD = 'campus'

/** Department heads who may sign in as 管理員 via their school Google account. */
export const ADMIN_INITIALS = ['TWL', 'LKL', 'YLN'] as const

export const ADMIN_USER: User = {
  id: 'u-admin',
  username: 'admin',
  password: STAFF_PASSWORD,
  name: '管理員',
  role: 'admin',
  classIds: [],
}

export function userFromWhitelistTeacher(teacher: WhitelistTeacher): User {
  return {
    id: teacherUserIdFromInitial(teacher.initial),
    username: teacher.email,
    password: STAFF_PASSWORD,
    name: `${teacher.name}老師`,
    role: 'teacher',
    classIds: teacher.classes.map(classNameToId),
  }
}

export function teachersForYear(startYear: number): User[] {
  return teacherWhitelistForYear(startYear).map(userFromWhitelistTeacher)
}

/** All staff who can sign in: admin + teachers across imported whitelist years. */
export const staffUsers: User[] = (() => {
  const byId = new Map<string, User>([[ADMIN_USER.id, ADMIN_USER]])
  for (const year of teacherWhitelistYears()) {
    for (const teacher of teacherWhitelistForYear(year)) {
      const user = userFromWhitelistTeacher(teacher)
      byId.set(user.id, user)
    }
  }
  return [...byId.values()]
})()

export function findStaffByEmail(email: string): User | undefined {
  const needle = email.trim().toLowerCase()
  if (!needle) return undefined
  return staffUsers.find(
    (u) => u.role === 'teacher' && u.username.toLowerCase() === needle,
  )
}

export function isAdminEmail(email: string): boolean {
  const needle = email.trim().toLowerCase()
  if (!needle) return false
  for (const year of teacherWhitelistYears()) {
    for (const teacher of teacherWhitelistForYear(year)) {
      if (
        (ADMIN_INITIALS as readonly string[]).includes(teacher.initial) &&
        teacher.email.toLowerCase() === needle
      ) {
        return true
      }
    }
  }
  return false
}

export function inferRoleFromEmail(email: string): Role {
  return isAdminEmail(email) ? 'admin' : 'teacher'
}

/** Keep a remembered role only if this account is allowed to use it. */
export function roleForStaff(email: string, preferred?: Role | null): Role {
  if (preferred === 'admin' && isAdminEmail(email)) return 'admin'
  if (preferred === 'teacher') return 'teacher'
  return inferRoleFromEmail(email)
}

/** Map a verified Google / school email to the campus user for the chosen role. */
export function resolveStaffUser(email: string, role: Role): User | null {
  const teacher = findStaffByEmail(email)
  if (!teacher) return null
  if (role === 'teacher') return teacher
  if (role === 'admin' && isAdminEmail(email)) {
    return { ...teacher, role: 'admin' }
  }
  return null
}
