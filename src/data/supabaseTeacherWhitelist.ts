import { supabase } from '../lib/supabase'
import type { WhitelistTeacher } from './teacherWhitelist'

const TABLE = 'teacher_whitelist_years'

export type WhitelistRemotePayload = {
  startYear: number
  teachers: WhitelistTeacher[]
  updatedBy: string
  updatedAt: string
}

type DbRow = {
  start_year: number
  teachers: WhitelistTeacher[]
  updated_by: string
  updated_at: string
}

function normalizeTeachers(raw: unknown): WhitelistTeacher[] {
  if (!Array.isArray(raw)) return []
  const out: WhitelistTeacher[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const t = item as Partial<WhitelistTeacher>
    const initial = String(t.initial ?? '').trim().toUpperCase()
    const email = String(t.email ?? '').trim().toLowerCase()
    if (!initial || !email) continue
    out.push({
      initial,
      name: String(t.name ?? '').trim(),
      email,
      classes: Array.isArray(t.classes)
        ? t.classes.map((c) => String(c).trim()).filter(Boolean)
        : [],
    })
  }
  return out
}

export async function listTeacherWhitelistYearsRemote(): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_year')
    .order('start_year', { ascending: false })
  if (error) {
    console.warn('[teacher_whitelist_years] list failed', error.message)
    return []
  }
  return (data ?? [])
    .map((r) => (r as { start_year?: number }).start_year)
    .filter((y): y is number => typeof y === 'number' && Number.isFinite(y))
}

export async function fetchTeacherWhitelistYear(
  startYear: number,
): Promise<WhitelistRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[teacher_whitelist_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  const row = data as DbRow
  return {
    startYear: row.start_year,
    teachers: normalizeTeachers(row.teachers),
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export async function upsertTeacherWhitelistYear(
  startYear: number,
  teachers: WhitelistTeacher[],
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(
    {
      start_year: startYear,
      teachers: normalizeTeachers(teachers),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'start_year' },
  )
  if (error) {
    console.warn('[teacher_whitelist_years] upsert failed', error.message)
    return false
  }
  return true
}
