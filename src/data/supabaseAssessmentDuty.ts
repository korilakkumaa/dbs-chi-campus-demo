import { supabase } from '../lib/supabase'
import type { AssessmentDutyYear } from './assessmentDutyTypes'
import type { GradeDutyRow } from './assessmentDutyTypes'
import type { EcAppendixRow } from './assessmentDutyParse'
import { withDerivedAssessmentTeachers } from './assessmentDutyDerive'

const TABLE = 'assessment_duty_years'

export type AssessmentDutyRemotePayload = {
  startYear: number
  label: string
  title: string
  categoryLabels: AssessmentDutyYear['categoryLabels']
  categoryShortLabels: AssessmentDutyYear['categoryShortLabels']
  gradeMatrix: GradeDutyRow[]
  ecAppendix: EcAppendixRow[]
  updatedBy: string
  updatedAt: string
}

type DbRow = {
  start_year: number
  label: string
  title: string
  category_labels: AssessmentDutyYear['categoryLabels']
  category_short_labels: AssessmentDutyYear['categoryShortLabels']
  grade_matrix: GradeDutyRow[]
  ec_appendix: EcAppendixRow[]
  updated_by: string
  updated_at: string
}

function rowToPayload(row: DbRow): AssessmentDutyRemotePayload | null {
  if (row.start_year == null) return null
  if (!Array.isArray(row.grade_matrix) || !Array.isArray(row.ec_appendix)) return null
  return {
    startYear: row.start_year,
    label: row.label ?? '',
    title: row.title ?? '',
    categoryLabels: row.category_labels ?? ({} as AssessmentDutyYear['categoryLabels']),
    categoryShortLabels:
      row.category_short_labels ?? ({} as AssessmentDutyYear['categoryShortLabels']),
    gradeMatrix: row.grade_matrix,
    ecAppendix: row.ec_appendix,
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function payloadToAssessmentDuty(
  payload: AssessmentDutyRemotePayload,
): AssessmentDutyYear {
  return withDerivedAssessmentTeachers({
    startYear: payload.startYear,
    label: payload.label,
    title: payload.title,
    categoryLabels: payload.categoryLabels,
    categoryShortLabels: payload.categoryShortLabels,
    gradeMatrix: payload.gradeMatrix,
    ecAppendix: payload.ecAppendix,
  })
}

export async function listAssessmentDutyYearsRemote(): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_year')
    .order('start_year', { ascending: false })
  if (error) {
    console.warn('[assessment_duty_years] list failed', error.message)
    return []
  }
  const years = new Set<number>()
  for (const row of data ?? []) {
    const y = (row as { start_year?: number }).start_year
    if (typeof y === 'number' && Number.isFinite(y)) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

export async function fetchAssessmentDutyYear(
  startYear: number,
): Promise<AssessmentDutyRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[assessment_duty_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  return rowToPayload(data as DbRow)
}

export async function upsertAssessmentDutyYear(
  duty: AssessmentDutyYear,
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const row = {
    start_year: duty.startYear,
    label: duty.label,
    title: duty.title,
    category_labels: duty.categoryLabels,
    category_short_labels: duty.categoryShortLabels,
    grade_matrix: duty.gradeMatrix,
    ec_appendix: duty.ecAppendix,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'start_year' })
  if (error) {
    console.warn('[assessment_duty_years] upsert failed', error.message)
    return false
  }
  return true
}
