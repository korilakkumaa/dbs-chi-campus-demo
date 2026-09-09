import {
  hasTeacherWhitelistYear as hasSeedYear,
  setTeacherWhitelistOverlay,
  teacherWhitelistForYear as seedWhitelistForYear,
  teacherWhitelistYears as seedWhitelistYears,
  type WhitelistTeacher,
} from './teacherWhitelist'
import {
  fetchTeacherWhitelistYear,
  listTeacherWhitelistYearsRemote,
  upsertTeacherWhitelistYear,
} from './supabaseTeacherWhitelist'

const cache = new Map<number, WhitelistTeacher[]>()
const hydrated = new Set<number>()
const knownYears = new Set<number>(seedWhitelistYears())
let remoteYearsLoaded = false

export function peekTeacherWhitelist(startYear: number): WhitelistTeacher[] {
  return cache.get(startYear) ?? seedWhitelistForYear(startYear)
}

export function listKnownWhitelistYears(): number[] {
  return [...knownYears].sort((a, b) => b - a)
}

export function hasKnownWhitelistYear(startYear: number): boolean {
  return knownYears.has(startYear) || hasSeedYear(startYear) || cache.has(startYear)
}

export async function discoverTeacherWhitelistYears(): Promise<number[]> {
  if (!remoteYearsLoaded) {
    const remote = await listTeacherWhitelistYearsRemote()
    for (const y of remote) knownYears.add(y)
    remoteYearsLoaded = true
  }
  for (const y of seedWhitelistYears()) knownYears.add(y)
  return listKnownWhitelistYears()
}

export async function hydrateTeacherWhitelist(
  startYear: number,
): Promise<WhitelistTeacher[]> {
  if (hydrated.has(startYear) && cache.has(startYear)) {
    return cache.get(startYear) ?? []
  }
  const remote = await fetchTeacherWhitelistYear(startYear)
  const teachers = remote?.teachers?.length
    ? remote.teachers
    : seedWhitelistForYear(startYear)
  cache.set(startYear, teachers)
  hydrated.add(startYear)
  if (teachers.length > 0) knownYears.add(startYear)
  setTeacherWhitelistOverlay(startYear, teachers)
  return teachers
}

/** Ensure latest years used by auth are hydrated. */
export async function hydrateAllSeedWhitelistYears(): Promise<void> {
  await discoverTeacherWhitelistYears()
  await Promise.all(listKnownWhitelistYears().map((y) => hydrateTeacherWhitelist(y)))
}

export async function saveTeacherWhitelist(
  startYear: number,
  teachers: WhitelistTeacher[],
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await upsertTeacherWhitelistYear(startYear, teachers, updatedBy)
  if (!ok) {
    return {
      ok: false,
      error: '儲存白名單失敗（請確認已執行 year-setup migration 且 Supabase 已設定）',
    }
  }
  cache.set(startYear, teachers)
  hydrated.add(startYear)
  knownYears.add(startYear)
  setTeacherWhitelistOverlay(startYear, teachers)
  return { ok: true }
}

export function invalidateTeacherWhitelist(startYear?: number): void {
  if (startYear == null) {
    cache.clear()
    hydrated.clear()
    for (const y of seedWhitelistYears()) setTeacherWhitelistOverlay(y, null)
    return
  }
  cache.delete(startYear)
  hydrated.delete(startYear)
  setTeacherWhitelistOverlay(startYear, null)
}

/**
 * Reassign which teacher owns a class name in the whitelist document.
 * Removes the class from all teachers, then appends to the target teacher.
 */
export async function assignClassInWhitelist(
  startYear: number,
  className: string,
  teacherInitial: string | null,
  updatedBy: string,
): Promise<{ ok: boolean; teachers: WhitelistTeacher[]; error?: string }> {
  const teachers = structuredClone(await hydrateTeacherWhitelist(startYear))
  const cleaned = teachers.map((t) => ({
    ...t,
    classes: t.classes.filter((c) => c !== className),
  }))
  if (teacherInitial) {
    const target = cleaned.find(
      (t) => t.initial.toUpperCase() === teacherInitial.toUpperCase(),
    )
    if (!target) {
      return { ok: false, teachers, error: `找不到教師 ${teacherInitial}` }
    }
    if (!target.classes.includes(className)) target.classes.push(className)
  }
  const saved = await saveTeacherWhitelist(startYear, cleaned, updatedBy)
  if (!saved.ok) return { ok: false, teachers, error: saved.error }
  return { ok: true, teachers: cleaned }
}
