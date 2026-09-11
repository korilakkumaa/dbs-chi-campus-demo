import { supabase } from './supabase'
import { ADMIN_INITIALS } from '../data/staffUsers'
import {
  findWhitelistTeacherByEmail,
  latestTeacherWhitelistYear,
  teacherWhitelistYears,
} from '../data/teacherWhitelist'
import { peekTeacherWhitelist } from '../data/whitelistStore'
import type { YearCsvKind } from './yearCsv/schemas'
import type { WhitelistTeacher } from '../data/teacherWhitelist'
import type { AssessmentDutyYear } from '../data/assessmentDutyTypes'
import type { DeptDutyYear } from '../data/deptDutyTypes'
import type { GradeDeadline } from '../types'
import type {
  CalendarCsvRow,
  RosterCsvRow,
  ScoreCsvRow,
  StreamingCsvRow,
  TimetableYearMap,
} from './yearCsv/schemas'
import { upsertTeacherWhitelistYear } from '../data/supabaseTeacherWhitelist'
import { upsertGradeDeadlinesYear } from '../data/supabaseGradeDeadlines'
import { upsertAssessmentDutyYear } from '../data/supabaseAssessmentDuty'
import { upsertDeptDutyYear } from '../data/supabaseDeptDuty'
import { upsertTeacherTimetableYear } from '../data/supabaseTeacherTimetable'
import { classNameToId } from '../data/teacherWhitelist'

export type YearImportResult = {
  ok: boolean
  kind: YearCsvKind
  upserted: number
  error?: string
  details?: string
}

function isAdminEmail(email: string): boolean {
  const needle = email.trim().toLowerCase()
  if (!needle) return false
  const years = new Set([
    ...teacherWhitelistYears(),
    latestTeacherWhitelistYear(),
  ])
  for (const year of years) {
    for (const teacher of peekTeacherWhitelist(year)) {
      if (
        (ADMIN_INITIALS as readonly string[]).includes(teacher.initial) &&
        teacher.email.toLowerCase() === needle
      ) {
        return true
      }
    }
    const seed = findWhitelistTeacherByEmail(needle, year)
    if (
      seed &&
      (ADMIN_INITIALS as readonly string[]).includes(seed.initial)
    ) {
      return true
    }
  }
  return false
}

async function invokeEdge(
  kind: YearCsvKind,
  startYear: number,
  payload: unknown,
  replaceMode: boolean,
): Promise<YearImportResult | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.functions.invoke('admin-year-import', {
      body: { kind, startYear, payload, replaceMode },
    })
    if (error) {
      console.warn('[admin-year-import] edge invoke failed', error.message)
      return null
    }
    if (data && typeof data === 'object' && 'ok' in data) {
      return data as YearImportResult
    }
    return null
  } catch (e) {
    console.warn('[admin-year-import] edge unavailable', e)
    return null
  }
}

function gradeFromClassName(name: string): number | null {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

async function applyRosterLocal(
  startYear: number,
  rows: RosterCsvRow[],
  updatedBy: string,
): Promise<YearImportResult> {
  if (!supabase) {
    return { ok: false, kind: 'student_roster', upserted: 0, error: '缺少 Supabase 設定' }
  }
  const classMap = new Map<string, { id: string; name: string; grade: number }>()
  for (const row of rows) {
    const id = classNameToId(row.class_name)
    const grade = gradeFromClassName(row.class_name) ?? 0
    classMap.set(id, { id, name: row.class_name, grade })
  }
  const classes = [...classMap.values()]
  if (classes.length) {
    const { error } = await supabase.from('classes').upsert(classes, { onConflict: 'id' })
    if (error) {
      return { ok: false, kind: 'student_roster', upserted: 0, error: error.message }
    }
  }
  const students = rows.map((r) => ({
    student_no: r.student_no,
    class_id: classNameToId(r.class_name),
    class_number: r.class_number,
    name_zh: r.name_zh,
    name_en: r.name_en,
    house: r.house,
    french: r.french,
    roster_remarks: r.remarks,
    academic_year_start: startYear,
  }))
  const { error } = await supabase.from('students').upsert(students, {
    onConflict: 'student_no',
  })
  if (error) {
    return { ok: false, kind: 'student_roster', upserted: 0, error: error.message }
  }
  return {
    ok: true,
    kind: 'student_roster',
    upserted: students.length,
    details: `updatedBy=${updatedBy}`,
  }
}

async function applyStreamingLocal(
  rows: StreamingCsvRow[],
): Promise<YearImportResult> {
  if (!supabase) {
    return { ok: false, kind: 'chinese_streaming', upserted: 0, error: '缺少 Supabase 設定' }
  }
  let upserted = 0
  for (const row of rows) {
    const { error } = await supabase
      .from('students')
      .update({ teaching_group: row.teaching_group, french: row.french })
      .eq('student_no', row.student_no)
    if (error) {
      return { ok: false, kind: 'chinese_streaming', upserted, error: error.message }
    }
    upserted++
  }
  return { ok: true, kind: 'chinese_streaming', upserted }
}

async function applyScoresLocal(
  startYear: number,
  rows: ScoreCsvRow[],
): Promise<YearImportResult> {
  if (!supabase) {
    return { ok: false, kind: 'semester_scores', upserted: 0, error: '缺少 Supabase 設定' }
  }
  const payload = rows.map((r) => ({
    student_no: r.student_no,
    academic_year_start: startYear,
    semester: r.semester,
    daily: r.daily,
    reading: r.reading,
    writing: r.writing,
    components: {},
  }))
  const { error } = await supabase.from('semester_records').upsert(payload, {
    onConflict: 'student_no,academic_year_start,semester',
  })
  if (error) {
    return { ok: false, kind: 'semester_scores', upserted: 0, error: error.message }
  }
  return { ok: true, kind: 'semester_scores', upserted: payload.length }
}

async function applyCalendarLocal(
  startYear: number,
  rows: CalendarCsvRow[],
  replaceMode: boolean,
  updatedBy: string,
): Promise<YearImportResult> {
  if (!supabase) {
    return { ok: false, kind: 'school_calendar', upserted: 0, error: '缺少 Supabase 設定' }
  }
  if (replaceMode) {
    const { error: delErr } = await supabase
      .from('campus_calendar_events')
      .delete()
      .eq('school_year_start', startYear)
      .eq('created_by', 'csv-import')
    if (delErr) {
      return { ok: false, kind: 'school_calendar', upserted: 0, error: delErr.message }
    }
  }
  const events = rows.map((r, i) => ({
    id: `csv-${startYear}-${r.date}-${i}-${r.title}`.slice(0, 180),
    date: r.date,
    title: r.notes ? `${r.title}（${r.notes}）` : r.title,
    kind: r.kind,
    school_year_start: startYear,
    created_by: updatedBy || 'csv-import',
    audience: { type: 'all' },
    lesson: null,
    deleted: false,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('campus_calendar_events').upsert(events, {
    onConflict: 'id',
  })
  if (error) {
    return { ok: false, kind: 'school_calendar', upserted: 0, error: error.message }
  }
  return { ok: true, kind: 'school_calendar', upserted: events.length }
}

export async function applyYearCsvImport(input: {
  kind: YearCsvKind
  startYear: number
  userEmail: string
  userId: string
  replaceMode?: boolean
  whitelist?: WhitelistTeacher[]
  roster?: RosterCsvRow[]
  streaming?: StreamingCsvRow[]
  calendar?: CalendarCsvRow[]
  assessment?: AssessmentDutyYear
  dept?: DeptDutyYear
  scores?: ScoreCsvRow[]
  deadlines?: GradeDeadline[]
  timetables?: TimetableYearMap
}): Promise<YearImportResult> {
  if (!isAdminEmail(input.userEmail)) {
    return {
      ok: false,
      kind: input.kind,
      upserted: 0,
      error: '僅管理員可匯入年度資料',
    }
  }

  const replaceMode = Boolean(input.replaceMode)
  const edgePayload =
    input.whitelist ??
    input.roster ??
    input.streaming ??
    input.calendar ??
    input.assessment ??
    input.dept ??
    input.scores ??
    input.deadlines ??
    input.timetables

  const edge = await invokeEdge(input.kind, input.startYear, edgePayload, replaceMode)
  if (edge) return edge

  // Local fallback (authenticated RLS writes) when Edge is not deployed yet.
  switch (input.kind) {
    case 'teacher_whitelist': {
      if (!input.whitelist) {
        return { ok: false, kind: input.kind, upserted: 0, error: '缺少白名單資料' }
      }
      const ok = await upsertTeacherWhitelistYear(
        input.startYear,
        input.whitelist,
        input.userId,
      )
      return ok
        ? { ok: true, kind: input.kind, upserted: input.whitelist.length }
        : { ok: false, kind: input.kind, upserted: 0, error: '白名單寫入失敗' }
    }
    case 'grade_deadlines': {
      if (!input.deadlines) {
        return { ok: false, kind: input.kind, upserted: 0, error: '缺少截止日期資料' }
      }
      const ok = await upsertGradeDeadlinesYear(
        input.startYear,
        input.deadlines,
        input.userId,
      )
      return ok
        ? { ok: true, kind: input.kind, upserted: input.deadlines.length }
        : { ok: false, kind: input.kind, upserted: 0, error: '截止日期寫入失敗' }
    }
    case 'assessment_duty': {
      if (!input.assessment) {
        return { ok: false, kind: input.kind, upserted: 0, error: '缺少出卷資料' }
      }
      const ok = await upsertAssessmentDutyYear(input.assessment, input.userId)
      return ok
        ? { ok: true, kind: input.kind, upserted: 1 }
        : { ok: false, kind: input.kind, upserted: 0, error: '出卷寫入失敗' }
    }
    case 'dept_duty': {
      if (!input.dept) {
        return { ok: false, kind: input.kind, upserted: 0, error: '缺少職責資料' }
      }
      const ok = await upsertDeptDutyYear(input.dept, input.userId)
      return ok
        ? { ok: true, kind: input.kind, upserted: input.dept.items.length }
        : { ok: false, kind: input.kind, upserted: 0, error: '職責寫入失敗' }
    }
    case 'teacher_timetable': {
      if (!input.timetables) {
        return { ok: false, kind: input.kind, upserted: 0, error: '缺少時間表資料' }
      }
      const ok = await upsertTeacherTimetableYear(
        input.startYear,
        input.timetables,
        input.userId,
      )
      const count = Object.keys(input.timetables).length
      return ok
        ? { ok: true, kind: input.kind, upserted: count }
        : { ok: false, kind: input.kind, upserted: 0, error: '時間表寫入失敗' }
    }
    case 'student_roster':
      return applyRosterLocal(input.startYear, input.roster ?? [], input.userId)
    case 'chinese_streaming':
      return applyStreamingLocal(input.streaming ?? [])
    case 'semester_scores':
      return applyScoresLocal(input.startYear, input.scores ?? [])
    case 'school_calendar':
      return applyCalendarLocal(
        input.startYear,
        input.calendar ?? [],
        replaceMode,
        input.userId,
      )
    default:
      return { ok: false, kind: input.kind, upserted: 0, error: '未知匯入類型' }
  }
}
