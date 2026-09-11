import { supabase } from '../lib/supabase'
import type {
  AcademicYearWindow,
  DayPeriod,
  SchoolWeekday,
  TeacherTimetableEntry,
} from './teacherTimetable'

const TABLE = 'teacher_timetable_years'

export type TimetableYearMap = Record<string, TeacherTimetableEntry>

export type TimetableRemotePayload = {
  startYear: number
  timetables: TimetableYearMap
  updatedBy: string
  updatedAt: string
}

type DbRow = {
  start_year: number
  timetables: unknown
  updated_by: string
  updated_at: string
}

function isSchoolWeekday(n: number): n is SchoolWeekday {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5
}

function normalizePeriod(raw: unknown): DayPeriod | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const start = String(p.start ?? '').trim()
  const end = String(p.end ?? '').trim()
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null
  const type = String(p.type ?? '').trim()
  if (type === 'lesson') {
    return {
      type: 'lesson',
      start,
      end,
      subject: String(p.subject ?? '').trim(),
      group: String(p.group ?? '').trim(),
      room: String(p.room ?? '').trim(),
    }
  }
  if (type === 'free') {
    return { type: 'free', start, end }
  }
  if (type === 'break') {
    return {
      type: 'break',
      start,
      end,
      label: String(p.label ?? '').trim() || undefined,
    }
  }
  return null
}

function normalizeAcademicYear(
  raw: unknown,
  startYear: number,
): AcademicYearWindow {
  const fallback: AcademicYearWindow = {
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    validFrom: `${startYear}-09-01`,
    validTo: `${startYear + 1}-08-31`,
    teachingUntil: `${startYear + 1}-07-12`,
  }
  if (!raw || typeof raw !== 'object') return fallback
  const y = raw as Partial<AcademicYearWindow>
  return {
    label: String(y.label ?? fallback.label).trim() || fallback.label,
    validFrom: String(y.validFrom ?? fallback.validFrom).trim() || fallback.validFrom,
    validTo: String(y.validTo ?? fallback.validTo).trim() || fallback.validTo,
    teachingUntil:
      String(y.teachingUntil ?? fallback.teachingUntil).trim() ||
      fallback.teachingUntil,
  }
}

function emptyWeekly(): Record<SchoolWeekday, DayPeriod[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] }
}

export function normalizeTimetableMap(
  raw: unknown,
  startYear: number,
): TimetableYearMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: TimetableYearMap = {}
  for (const [teacherId, entryRaw] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    const id = String(teacherId).trim()
    if (!id) continue
    if (!entryRaw || typeof entryRaw !== 'object') continue
    const entry = entryRaw as {
      academicYear?: unknown
      weekly?: unknown
    }
    const weekly = emptyWeekly()
    if (entry.weekly && typeof entry.weekly === 'object') {
      for (const [dayKey, periodsRaw] of Object.entries(
        entry.weekly as Record<string, unknown>,
      )) {
        const day = Number(dayKey)
        if (!isSchoolWeekday(day)) continue
        if (!Array.isArray(periodsRaw)) continue
        weekly[day] = periodsRaw
          .map(normalizePeriod)
          .filter((p): p is DayPeriod => p != null)
      }
    }
    out[id] = {
      academicYear: normalizeAcademicYear(entry.academicYear, startYear),
      weekly,
    }
  }
  return out
}

export async function listTeacherTimetableYearsRemote(): Promise<number[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('start_year')
    .order('start_year', { ascending: false })
  if (error) {
    console.warn('[teacher_timetable_years] list failed', error.message)
    return []
  }
  return (data ?? [])
    .map((r) => (r as { start_year?: number }).start_year)
    .filter((y): y is number => typeof y === 'number' && Number.isFinite(y))
}

export async function fetchTeacherTimetableYear(
  startYear: number,
): Promise<TimetableRemotePayload | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('start_year', startYear)
    .maybeSingle()
  if (error) {
    console.warn('[teacher_timetable_years] fetch failed', error.message)
    return null
  }
  if (!data) return null
  const row = data as DbRow
  return {
    startYear: row.start_year,
    timetables: normalizeTimetableMap(row.timetables, startYear),
    updatedBy: row.updated_by ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export async function upsertTeacherTimetableYear(
  startYear: number,
  timetables: TimetableYearMap,
  updatedBy: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(
    {
      start_year: startYear,
      timetables: normalizeTimetableMap(timetables, startYear),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'start_year' },
  )
  if (error) {
    console.warn('[teacher_timetable_years] upsert failed', error.message)
    return false
  }
  return true
}
