import type { User } from '../types'
import { canMutateDutyDocs } from '../lib/permissions'
import {
  hasSeedTimetableYear,
  seedTimetableYears,
  seedTimetablesForYear,
  setTeacherTimetableOverlay,
  weeklyTimetablesForYear,
  type TeacherTimetableEntry,
} from './teacherTimetable'
import {
  fetchTeacherTimetableYear,
  listTeacherTimetableYearsRemote,
  type TimetableYearMap,
  upsertTeacherTimetableYear,
} from './supabaseTeacherTimetable'

const cache = new Map<number, TimetableYearMap>()
const hydrated = new Set<number>()
const knownYears = new Set<number>(seedTimetableYears())
let remoteYearsLoaded = false

export function canMutateTimetables(user: User | null | undefined): boolean {
  return canMutateDutyDocs(user)
}

export function peekTeacherTimetables(startYear: number): TimetableYearMap {
  return cache.get(startYear) ?? weeklyTimetablesForYear(startYear)
}

export function listKnownTimetableYears(): number[] {
  return [...knownYears].sort((a, b) => b - a)
}

export function hasKnownTimetableYear(startYear: number): boolean {
  return (
    knownYears.has(startYear) ||
    hasSeedTimetableYear(startYear) ||
    cache.has(startYear)
  )
}

export function timetableYearStatus(startYear: number): {
  hasSeed: boolean
  teacherCount: number
  hasCached: boolean
  known: boolean
} {
  const map = peekTeacherTimetables(startYear)
  const teacherCount = Object.keys(map).length
  return {
    hasSeed: hasSeedTimetableYear(startYear),
    teacherCount,
    hasCached: cache.has(startYear),
    known: teacherCount > 0 || knownYears.has(startYear),
  }
}

export async function discoverTeacherTimetableYears(): Promise<number[]> {
  if (!remoteYearsLoaded) {
    const remote = await listTeacherTimetableYearsRemote()
    for (const y of remote) knownYears.add(y)
    remoteYearsLoaded = true
  }
  for (const y of seedTimetableYears()) knownYears.add(y)
  return listKnownTimetableYears()
}

export async function hydrateTeacherTimetables(
  startYear: number,
): Promise<TimetableYearMap> {
  if (hydrated.has(startYear) && cache.has(startYear)) {
    return cache.get(startYear) ?? {}
  }
  const remote = await fetchTeacherTimetableYear(startYear)
  const timetables =
    remote && Object.keys(remote.timetables).length > 0
      ? remote.timetables
      : seedTimetablesForYear(startYear)
  cache.set(startYear, timetables)
  hydrated.add(startYear)
  if (Object.keys(timetables).length > 0) knownYears.add(startYear)
  setTeacherTimetableOverlay(startYear, timetables)
  return timetables
}

/** Ensure seed + remote years used by staff views are hydrated. */
export async function hydrateAllSeedTimetableYears(): Promise<void> {
  await discoverTeacherTimetableYears()
  await Promise.all(
    listKnownTimetableYears().map((y) => hydrateTeacherTimetables(y)),
  )
}

export async function saveTeacherTimetables(
  startYear: number,
  timetables: TimetableYearMap,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await upsertTeacherTimetableYear(startYear, timetables, updatedBy)
  if (!ok) {
    return {
      ok: false,
      error:
        '儲存時間表失敗（請確認已執行 teacher_timetable_years migration 且 Supabase 已設定）',
    }
  }
  cache.set(startYear, timetables)
  hydrated.add(startYear)
  knownYears.add(startYear)
  setTeacherTimetableOverlay(startYear, timetables)
  return { ok: true }
}

/** Publish committed seed grids to Supabase so teachers see the same year doc. */
export async function publishSeedTimetables(
  startYear: number,
  updatedBy: string,
): Promise<{ ok: boolean; teacherCount: number; error?: string }> {
  const seed = seedTimetablesForYear(startYear)
  const teacherCount = Object.keys(seed).length
  if (teacherCount === 0) {
    return { ok: false, teacherCount: 0, error: `沒有 ${startYear} 學年種子時間表` }
  }
  const saved = await saveTeacherTimetables(startYear, structuredClone(seed), updatedBy)
  if (!saved.ok) return { ok: false, teacherCount, error: saved.error }
  return { ok: true, teacherCount }
}

export function invalidateTeacherTimetables(startYear?: number): void {
  if (startYear == null) {
    cache.clear()
    hydrated.clear()
    for (const y of seedTimetableYears()) setTeacherTimetableOverlay(y, null)
    return
  }
  cache.delete(startYear)
  hydrated.delete(startYear)
  setTeacherTimetableOverlay(startYear, null)
}

export type { TeacherTimetableEntry, TimetableYearMap }
