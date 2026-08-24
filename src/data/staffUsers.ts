import type { User } from '../types'
import {
  classNameToId,
  teacherUserIdFromInitial,
  teacherWhitelistForYear,
  teacherWhitelistYears,
  type WhitelistTeacher,
} from './teacherWhitelist'

const STAFF_PASSWORD = 'campus'

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
