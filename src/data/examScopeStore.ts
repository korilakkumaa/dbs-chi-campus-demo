import type { User } from '../types'
import { canMutateDutyDocs } from '../lib/permissions'
import {
  cloneExamScopeForYear,
  createEmptyExamScope,
  createSeedExamScope,
} from './examScopeFactory'
import type { ExamScopeYear } from './examScopeTypes'
import {
  fetchExamScopeYear,
  listExamScopeYearsRemote,
  payloadToExamScope,
  upsertExamScopeYear,
} from './supabaseExamScope'

const cache = new Map<number, ExamScopeYear>()
const hydrated = new Set<number>()
/** Years with a remote (or locally bootstrapped) document — not mere seed fallback. */
const remoteKnownYears = new Set<number>()
let remoteYearsLoaded = false

export function canMutateExamScope(user: User | null | undefined): boolean {
  return canMutateDutyDocs(user)
}

function seedDoc(startYear: number): ExamScopeYear {
  return createSeedExamScope(startYear)
}

export function peekExamScope(startYear: number): ExamScopeYear {
  return cache.get(startYear) ?? seedDoc(startYear)
}

/** True when this year has a saved / bootstrapped doc tracked as remote-known. */
export function hasExamScopeRemote(startYear: number): boolean {
  return remoteKnownYears.has(startYear)
}

export function listHydratedExamScopeYears(): number[] {
  return [...remoteKnownYears].sort((a, b) => b - a)
}

export async function discoverExamScopeYears(): Promise<number[]> {
  if (!remoteYearsLoaded) {
    const remote = await listExamScopeYearsRemote()
    for (const y of remote) remoteKnownYears.add(y)
    remoteYearsLoaded = true
  }
  return listHydratedExamScopeYears()
}

/**
 * Prefer Supabase year doc; fall back to static seed so teachers always see data.
 */
export async function hydrateExamScope(
  startYear: number,
): Promise<ExamScopeYear> {
  if (hydrated.has(startYear) && cache.has(startYear)) {
    return cache.get(startYear)!
  }

  const remote = await fetchExamScopeYear(startYear)
  const doc = remote ? payloadToExamScope(remote) : seedDoc(startYear)

  cache.set(startYear, doc)
  if (remote) remoteKnownYears.add(startYear)
  hydrated.add(startYear)
  return doc
}

export type BootstrapExamScopeMode = 'empty' | 'seed' | 'clone'

export async function bootstrapExamScope(
  startYear: number,
  mode: BootstrapExamScopeMode,
  cloneFromYear?: number,
): Promise<{ ok: boolean; doc?: ExamScopeYear; error?: string }> {
  let doc: ExamScopeYear
  if (mode === 'clone') {
    const from = cloneFromYear ?? startYear - 1
    const source = await hydrateExamScope(from)
    doc = cloneExamScopeForYear(source, startYear)
  } else if (mode === 'seed') {
    doc = createSeedExamScope(startYear)
  } else {
    doc = createEmptyExamScope(startYear)
  }
  cache.set(startYear, doc)
  remoteKnownYears.add(startYear)
  hydrated.add(startYear)
  return { ok: true, doc }
}

export async function saveExamScope(
  doc: ExamScopeYear,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await upsertExamScopeYear(doc, updatedBy)
  if (!ok) return { ok: false, error: '測考範圍寫入失敗' }
  cache.set(doc.startYear, doc)
  remoteKnownYears.add(doc.startYear)
  hydrated.add(doc.startYear)
  return { ok: true }
}

export function invalidateExamScope(startYear?: number): void {
  if (startYear == null) {
    cache.clear()
    hydrated.clear()
    remoteYearsLoaded = false
    return
  }
  cache.delete(startYear)
  hydrated.delete(startYear)
}
