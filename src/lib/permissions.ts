import type { Role, User } from '../types'

/** Thin capability helpers — keep page code free of scattered `role === 'admin'` checks. */

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'admin'
}

export function isTeacher(user: User | null | undefined): boolean {
  return user?.role === 'teacher'
}

export function isStudent(user: User | null | undefined): boolean {
  return user?.role === 'student'
}

export function isStaff(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'teacher'
}

export function hasRole(
  user: User | null | undefined,
  role: Role,
): boolean {
  return user?.role === role
}

/** Admin-only mutation of assessment / dept duty year documents. */
export function canMutateDutyDocs(user: User | null | undefined): boolean {
  return isAdmin(user)
}

/** Admin can mutate any shared calendar event; teachers only personal. */
export function canAccessAdminConsole(user: User | null | undefined): boolean {
  return isAdmin(user)
}

/** Show admin preview pickers (e.g. other teachers' duties). */
export function canPreviewAllTeachers(user: User | null | undefined): boolean {
  return isAdmin(user)
}
