import { supabase } from '../lib/supabase'
import type { DeptDutyItem, DeptDutyYear } from './deptDutyTypes'
import { withDerivedDeptTeachers } from './deptDutyDerive'

const TABLE = 'dept_duty_years'

export type DeptDutyRemotePayload = {
  startYear: number
  label: string
  source: string
  items: DeptDutyItem[]
  updatedBy: string
  updatedAt: string
}

type DbRow = {
  start_year: number
  label: string
  source: string
  items: DeptDutyItem[]
  updated_by: string
  updated_at: string
}

function rowToPayload(row: DbRow): DeptDutyRemotePayload | null {
  if (row.start_year == null) return null
  if (!Array.isArray(row.items)) return null
  return {
    startYear: row.start_year,
    label: row.label ?? '',
    source: row.source ?? '',
    items: row.items,
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function payloadToDeptDuty(
  payload: DeptDutyRemotePayload,
  previous?: DeptDutyYear | null,
): DeptDutyYear {
  return withDerivedDeptTeachers({
    startYear: payload.startYear,
    label: payload.label,
    source: payload.source,
    items: payload.items,
    teachers: previous?.teachers,
  })
}

export async function listDeptDutyYearsRemote(): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_year')
    .order('start_year', { ascending: false })
  if (error) {
    console.warn('[dept_duty_years] list failed', error.message)
    return []
  }
  const years = new Set<number>()
  for (const row of data ?? []) {
    const y = (row as { start_year?: number }).start_year
    if (typeof y === 'number' && Number.isFinite(y)) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

export async function fetchDeptDutyYear(
  startYear: number,
): Promise<DeptDutyRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[dept_duty_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  return rowToPayload(data as DbRow)
}

export async function upsertDeptDutyYear(
  duty: DeptDutyYear,
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const row = {
    start_year: duty.startYear,
    label: duty.label,
    source: duty.source,
    items: duty.items,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'start_year' })
  if (error) {
    console.warn('[dept_duty_years] upsert failed', error.message)
    return false
  }
  return true
}
