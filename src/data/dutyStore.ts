import type { User } from '../types'
import { getAssessmentDuty as getSeedAssessmentDuty, listAssessmentDutyYears } from './assessmentDuty'
import { withDerivedAssessmentTeachers } from './assessmentDutyDerive'
import type { AssessmentDutyYear } from './assessmentDutyTypes'
import { getDeptDuty as getSeedDeptDuty, listDeptDutyYears } from './deptDuty'
import { withDerivedDeptTeachers } from './deptDutyDerive'
import type { DeptDutyYear } from './deptDutyTypes'
import {
  fetchAssessmentDutyYear,
  payloadToAssessmentDuty,
  upsertAssessmentDutyYear,
} from './supabaseAssessmentDuty'
import {
  fetchDeptDutyYear,
  payloadToDeptDuty,
  upsertDeptDutyYear,
} from './supabaseDeptDuty'

const assessmentCache = new Map<number, AssessmentDutyYear>()
const deptCache = new Map<number, DeptDutyYear>()
const assessmentHydrated = new Set<number>()
const deptHydrated = new Set<number>()

export function canMutateDuty(user: User | null | undefined): boolean {
  return user?.role === 'admin'
}

function seedAssessment(startYear: number): AssessmentDutyYear | null {
  const seed = getSeedAssessmentDuty(startYear)
  if (!seed) return null
  return withDerivedAssessmentTeachers(seed)
}

function seedDept(startYear: number): DeptDutyYear | null {
  const seed = getSeedDeptDuty(startYear)
  if (!seed) return null
  return withDerivedDeptTeachers(seed)
}

export function peekAssessmentDuty(startYear: number): AssessmentDutyYear | null {
  return assessmentCache.get(startYear) ?? seedAssessment(startYear)
}

export function peekDeptDuty(startYear: number): DeptDutyYear | null {
  return deptCache.get(startYear) ?? seedDept(startYear)
}

export async function hydrateAssessmentDuty(
  startYear: number,
): Promise<AssessmentDutyYear | null> {
  if (assessmentHydrated.has(startYear) && assessmentCache.has(startYear)) {
    return assessmentCache.get(startYear) ?? null
  }

  const remote = await fetchAssessmentDutyYear(startYear)
  const duty = remote
    ? payloadToAssessmentDuty(remote)
    : seedAssessment(startYear)

  if (duty) assessmentCache.set(startYear, duty)
  else assessmentCache.delete(startYear)
  assessmentHydrated.add(startYear)
  return duty
}

export async function hydrateDeptDuty(startYear: number): Promise<DeptDutyYear | null> {
  if (deptHydrated.has(startYear) && deptCache.has(startYear)) {
    return deptCache.get(startYear) ?? null
  }

  const seed = seedDept(startYear)
  const remote = await fetchDeptDutyYear(startYear)
  const duty = remote ? payloadToDeptDuty(remote, seed) : seed

  if (duty) deptCache.set(startYear, duty)
  else deptCache.delete(startYear)
  deptHydrated.add(startYear)
  return duty
}

export async function saveAssessmentDuty(
  duty: AssessmentDutyYear,
  user: User,
): Promise<{ ok: boolean; duty: AssessmentDutyYear | null; error?: string }> {
  if (!canMutateDuty(user)) {
    return { ok: false, duty: null, error: '僅管理員可儲存出卷資料' }
  }
  const next = withDerivedAssessmentTeachers(duty)
  const ok = await upsertAssessmentDutyYear(next, user.id)
  if (!ok) {
    return { ok: false, duty: null, error: '儲存失敗（請確認已執行 duty migration 且 Supabase 已設定）' }
  }
  assessmentCache.set(next.startYear, next)
  assessmentHydrated.add(next.startYear)
  return { ok: true, duty: next }
}

export async function saveDeptDuty(
  duty: DeptDutyYear,
  user: User,
): Promise<{ ok: boolean; duty: DeptDutyYear | null; error?: string }> {
  if (!canMutateDuty(user)) {
    return { ok: false, duty: null, error: '僅管理員可儲存職責資料' }
  }
  const previous = deptCache.get(duty.startYear) ?? seedDept(duty.startYear)
  const next = withDerivedDeptTeachers({ ...duty, teachers: previous?.teachers })
  const ok = await upsertDeptDutyYear(next, user.id)
  if (!ok) {
    return { ok: false, duty: null, error: '儲存失敗（請確認已執行 duty migration 且 Supabase 已設定）' }
  }
  deptCache.set(next.startYear, next)
  deptHydrated.add(next.startYear)
  return { ok: true, duty: next }
}

export function listHydratedAssessmentYears(): number[] {
  const years = new Set([...listAssessmentDutyYears(), ...assessmentCache.keys()])
  return [...years].sort((a, b) => b - a)
}

export function listHydratedDeptYears(): number[] {
  const years = new Set([...listDeptDutyYears(), ...deptCache.keys()])
  return [...years].sort((a, b) => b - a)
}

/** Drop hydrate flag so next load re-fetches remote (e.g. after discard). */
export function invalidateAssessmentDuty(startYear: number): void {
  assessmentHydrated.delete(startYear)
  assessmentCache.delete(startYear)
}

export function invalidateDeptDuty(startYear: number): void {
  deptHydrated.delete(startYear)
  deptCache.delete(startYear)
}
