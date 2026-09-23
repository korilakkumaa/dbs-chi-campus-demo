import { supabase } from '../lib/supabase'
import type { ExamScopeCohort, Paper1ExamScopeRow } from './paper1ExamScopeData'
import type { ExamScopeYear } from './examScopeTypes'

const TABLE = 'exam_scope_years'

const COHORTS: ExamScopeCohort[] = ['中四甲部', '中五甲部', '中六甲部']

export type ExamScopeRemotePayload = {
  startYear: number
  label: string
  source: string
  rows: Paper1ExamScopeRow[]
  updatedBy: string
  updatedAt: string
}

type DbRow = {
  start_year: number
  label: string
  source: string
  rows: unknown
  updated_by: string
  updated_at: string
}

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (!t || t === '0' || t === '0.0' || t === 'n' || t === 'no' || t === 'false') {
      return false
    }
    return true
  }
  return Boolean(v)
}

export function normalizeExamScopeRows(raw: unknown): Paper1ExamScopeRow[] {
  if (!Array.isArray(raw)) return []
  const out: Paper1ExamScopeRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const cohortRaw = String(row.cohort ?? '').trim()
    const title = String(row.title ?? '').trim()
    const unit = String(row.unit ?? '').trim()
    if (!cohortRaw && !title) continue
    if (!COHORTS.includes(cohortRaw as ExamScopeCohort)) continue
    if (!title || !unit) continue

    const flagsRaw =
      row.flags && typeof row.flags === 'object'
        ? (row.flags as Record<string, unknown>)
        : row

    const flags = {
      f4_s1_test: asBool(flagsRaw.f4_s1_test),
      f4_s1_exam: asBool(flagsRaw.f4_s1_exam),
      f4_s2_test: asBool(flagsRaw.f4_s2_test),
      f4_s2_exam: asBool(flagsRaw.f4_s2_exam),
      f5_s1_test: asBool(flagsRaw.f5_s1_test),
      f5_s1_exam: asBool(flagsRaw.f5_s1_exam),
      f5_s2_test: asBool(flagsRaw.f5_s2_test),
      f5_s2_exam: asBool(flagsRaw.f5_s2_exam),
      f6_test: asBool(flagsRaw.f6_test),
      f6_exam: asBool(flagsRaw.f6_exam),
    }

    const reviewCount = Number(row.reviewCount ?? row.review_count ?? 0)
    const scoreSchemeRaw = row.scoreScheme ?? row.score_scheme
    const scoreScheme =
      scoreSchemeRaw == null || String(scoreSchemeRaw).trim() === ''
        ? null
        : String(scoreSchemeRaw).trim()

    out.push({
      cohort: cohortRaw as ExamScopeCohort,
      cohortF4Year: String(row.cohortF4Year ?? row.cohort_f4_year ?? ''),
      cohortF5Year: String(row.cohortF5Year ?? row.cohort_f5_year ?? ''),
      cohortF6Year: String(row.cohortF6Year ?? row.cohort_f6_year ?? ''),
      firstTaughtFormTerm: String(
        row.firstTaughtFormTerm ?? row.first_taught_form_term ?? '',
      ),
      unit,
      title,
      scoreScheme,
      flags,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    })
  }
  return out
}

function rowToPayload(row: DbRow): ExamScopeRemotePayload | null {
  if (row.start_year == null) return null
  return {
    startYear: row.start_year,
    label: row.label ?? '',
    source: row.source ?? '',
    rows: normalizeExamScopeRows(row.rows),
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function payloadToExamScope(
  payload: ExamScopeRemotePayload,
): ExamScopeYear {
  return {
    startYear: payload.startYear,
    label: payload.label,
    source: payload.source,
    rows: payload.rows,
  }
}

export async function listExamScopeYearsRemote(): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_year')
    .order('start_year', { ascending: false })
  if (error) {
    console.warn('[exam_scope_years] list failed', error.message)
    return []
  }
  const years = new Set<number>()
  for (const row of data ?? []) {
    const y = (row as { start_year?: number }).start_year
    if (typeof y === 'number' && Number.isFinite(y)) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

export async function fetchExamScopeYear(
  startYear: number,
): Promise<ExamScopeRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[exam_scope_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  return rowToPayload(data as DbRow)
}

export async function upsertExamScopeYear(
  doc: ExamScopeYear,
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const row = {
    start_year: doc.startYear,
    label: doc.label,
    source: doc.source,
    rows: doc.rows,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'start_year' })
  if (error) {
    console.warn('[exam_scope_years] upsert failed', error.message)
    return false
  }
  return true
}
