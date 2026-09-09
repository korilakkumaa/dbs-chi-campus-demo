import { supabase } from '../lib/supabase'
import type { GradeDeadline } from '../types'
import { emptyGradeDeadlines } from './gradeDeadlines'

const TABLE = 'grade_deadlines_years'

export type DeadlinesRemotePayload = {
  startYear: number
  deadlines: GradeDeadline[]
  updatedBy: string
  updatedAt: string
}

function normalizeDeadlines(raw: unknown): GradeDeadline[] {
  const base = emptyGradeDeadlines()
  if (!Array.isArray(raw)) return base
  const byGrade = new Map(base.map((d) => [d.grade, { ...d }]))
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<GradeDeadline>
    const grade = Number(row.grade)
    if (!byGrade.has(grade)) continue
    byGrade.set(grade, {
      grade,
      readingDue: String(row.readingDue ?? ''),
      activityTitle: String(row.activityTitle ?? ''),
      activityDue: String(row.activityDue ?? ''),
      submitted: Boolean(row.submitted),
    })
  }
  return [...byGrade.values()]
}

export async function fetchGradeDeadlinesYear(
  startYear: number,
): Promise<DeadlinesRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[grade_deadlines_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  const row = data as {
    start_year: number
    deadlines: unknown
    updated_by: string
    updated_at: string
  }
  return {
    startYear: row.start_year,
    deadlines: normalizeDeadlines(row.deadlines),
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export async function upsertGradeDeadlinesYear(
  startYear: number,
  deadlines: GradeDeadline[],
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(
    {
      start_year: startYear,
      deadlines: normalizeDeadlines(deadlines),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'start_year' },
  )
  if (error) {
    console.warn('[grade_deadlines_years] upsert failed', error.message)
    return false
  }
  return true
}
