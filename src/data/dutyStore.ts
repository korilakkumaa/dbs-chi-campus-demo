import type { User } from '../types'
import { getAssessmentDuty as getSeedAssessmentDuty, listAssessmentDutyYears } from './assessmentDuty'
import {
  cloneAssessmentDutyForYear,
  createEmptyAssessmentDuty,
} from './assessmentDutyFactory'
import { withDerivedAssessmentTeachers } from './assessmentDutyDerive'
import type { AssessmentDutyYear } from './assessmentDutyTypes'
import { getDeptDuty as getSeedDeptDuty, listDeptDutyYears } from './deptDuty'
import {
  cloneDeptDutyForYear,
  createEmptyDeptDuty,
} from './deptDutyFactory'
import { withDerivedDeptTeachers } from './deptDutyDerive'
import type { DeptDutyYear } from './deptDutyTypes'
import {
  fetchAssessmentDutyYear,
  listAssessmentDutyYearsRemote,
  payloadToAssessmentDuty,
  upsertAssessmentDutyYear,
} from './supabaseAssessmentDuty'
import {
  fetchDeptDutyYear,
  listDeptDutyYearsRemote,
  payloadToDeptDuty,
  upsertDeptDutyYear,
} from './supabaseDeptDuty'

const assessmentCache = new Map<number, AssessmentDutyYear>()
const deptCache = new Map<number, DeptDutyYear>()
const assessmentHydrated = new Set<number>()
const deptHydrated = new Set<number>()
/** Years known from Supabase (even before hydrate), plus any locally bootstrapped. */
const assessmentKnownYears = new Set<number>(listAssessmentDutyYears())
const deptKnownYears = new Set<number>(listDeptDutyYears())
let assessmentRemoteYearsLoaded = false
let deptRemoteYearsLoaded = false

import { canMutateDutyDocs } from '../lib/permissions'

export function canMutateDuty(user: User | null | undefined): boolean {
  return canMutateDutyDocs(user)
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

function rememberAssessmentYear(startYear: number): void {
  assessmentKnownYears.add(startYear)
}

export function peekAssessmentDuty(startYear: number): AssessmentDutyYear | null {
  return assessmentCache.get(startYear) ?? seedAssessment(startYear)
}

export function peekDeptDuty(startYear: number): DeptDutyYear | null {
  return deptCache.get(startYear) ?? seedDept(startYear)
}

export async function discoverAssessmentDutyYears(): Promise<number[]> {
  if (!assessmentRemoteYearsLoaded) {
    const remote = await listAssessmentDutyYearsRemote()
    for (const y of remote) rememberAssessmentYear(y)
    assessmentRemoteYearsLoaded = true
  }
  return listHydratedAssessmentYears()
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

  if (duty) {
    assessmentCache.set(startYear, duty)
    rememberAssessmentYear(startYear)
  } else {
    assessmentCache.delete(startYear)
  }
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

  if (duty) {
    deptCache.set(startYear, duty)
    deptKnownYears.add(startYear)
  } else {
    deptCache.delete(startYear)
  }
  deptHydrated.add(startYear)
  return duty
}

export type BootstrapAssessmentMode = 'empty' | 'clone'
export type BootstrapDeptMode = 'empty' | 'clone'

/**
 * Create an in-memory year document for admin editing when seed/remote are missing.
 * Does not write to Supabase until saveAssessmentDuty.
 */
export async function bootstrapAssessmentDuty(
  startYear: number,
  mode: BootstrapAssessmentMode,
  cloneFromYear?: number,
): Promise<{ ok: boolean; duty: AssessmentDutyYear | null; error?: string }> {
  const existing = await hydrateAssessmentDuty(startYear)
  if (existing) {
    return { ok: true, duty: existing }
  }

  let duty: AssessmentDutyYear
  if (mode === 'clone') {
    const fromYear = cloneFromYear ?? startYear - 1
    const source =
      (await hydrateAssessmentDuty(fromYear)) ?? peekAssessmentDuty(fromYear)
    if (!source) {
      return {
        ok: false,
        duty: null,
        error: `找不到可複製的學年（${fromYear}）出卷資料`,
      }
    }
    duty = cloneAssessmentDutyForYear(source, startYear)
  } else {
    duty = createEmptyAssessmentDuty(startYear)
  }

  assessmentCache.set(startYear, duty)
  assessmentHydrated.add(startYear)
  rememberAssessmentYear(startYear)
  return { ok: true, duty }
}

export async function discoverDeptDutyYears(): Promise<number[]> {
  if (!deptRemoteYearsLoaded) {
    const remote = await listDeptDutyYearsRemote()
    for (const y of remote) deptKnownYears.add(y)
    deptRemoteYearsLoaded = true
  }
  return listHydratedDeptYears()
}

export async function bootstrapDeptDuty(
  startYear: number,
  mode: BootstrapDeptMode,
  cloneFromYear?: number,
): Promise<{ ok: boolean; duty: DeptDutyYear | null; error?: string }> {
  const existing = await hydrateDeptDuty(startYear)
  if (existing) {
    return { ok: true, duty: existing }
  }

  let duty: DeptDutyYear
  if (mode === 'clone') {
    const fromYear = cloneFromYear ?? startYear - 1
    const source =
      (await hydrateDeptDuty(fromYear)) ?? peekDeptDuty(fromYear)
    if (!source) {
      return {
        ok: false,
        duty: null,
        error: `找不到可複製的學年（${fromYear}）職責資料`,
      }
    }
    duty = cloneDeptDutyForYear(source, startYear)
  } else {
    duty = createEmptyDeptDuty(startYear)
  }

  deptCache.set(startYear, duty)
  deptHydrated.add(startYear)
  deptKnownYears.add(startYear)
  return { ok: true, duty }
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
  rememberAssessmentYear(next.startYear)
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
  const years = new Set([
    ...listAssessmentDutyYears(),
    ...assessmentKnownYears,
    ...assessmentCache.keys(),
  ])
  return [...years].sort((a, b) => b - a)
}

export function assessmentDutyYearStatus(startYear: number): {
  hasSeed: boolean
  hasCached: boolean
  known: boolean
} {
  const hasSeed = Boolean(getSeedAssessmentDuty(startYear))
  const hasCached = assessmentCache.has(startYear)
  return {
    hasSeed,
    hasCached,
    known: hasSeed || hasCached || assessmentKnownYears.has(startYear),
  }
}

export function listHydratedDeptYears(): number[] {
  const years = new Set([
    ...listDeptDutyYears(),
    ...deptKnownYears,
    ...deptCache.keys(),
  ])
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
