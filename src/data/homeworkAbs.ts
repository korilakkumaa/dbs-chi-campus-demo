import { supabase } from '../lib/supabase'
import { isAbsMarker } from './studentEmail'

const ITEMS = 'homework_abs_items'
const DISMISSALS = 'homework_abs_dismissals'
const LOGS = 'homework_abs_email_logs'

export type HomeworkAbsItem = {
  id: string
  academicYearStart: number
  classLabel: string
  groupLabel: string
  teacherInitial: string
  assignmentName: string
  studentNo: string
  classNumber: number | null
  studentName: string
  absRaw: string
  active: boolean
  syncedAt: string
}

export type HomeworkAbsDismissal = {
  id: string
  absItemId: string
  academicYearStart: number
  studentNo: string
  assignmentName: string
  dismissedBy: string
  dismissedAt: string
}

export type HomeworkAbsEmailLog = {
  id: string
  absItemId: string
  academicYearStart: number
  studentNo: string
  studentName: string
  classLabel: string
  groupLabel: string
  assignmentName: string
  toEmail: string
  teacherId: string
  teacherInitial: string
  status: 'queued' | 'sent' | 'failed'
  errorMessage: string
  createdAt: string
  sentAt: string | null
}

type ItemRow = {
  id: string
  academic_year_start: number
  class_label: string
  group_label: string
  teacher_initial: string
  assignment_name: string
  student_no: string
  class_number: number | null
  student_name: string
  abs_raw: string
  active: boolean
  synced_at: string
}

type DismissalRow = {
  id: string
  abs_item_id: string
  academic_year_start: number
  student_no: string
  assignment_name: string
  dismissed_by: string
  dismissed_at: string
}

type LogRow = {
  id: string
  abs_item_id: string
  academic_year_start: number
  student_no: string
  student_name: string
  class_label: string
  group_label: string
  assignment_name: string
  to_email: string
  teacher_id: string
  teacher_initial: string
  status: 'queued' | 'sent' | 'failed'
  error_message: string
  created_at: string
  sent_at: string | null
}

function rowToItem(row: ItemRow): HomeworkAbsItem {
  return {
    id: row.id,
    academicYearStart: row.academic_year_start,
    classLabel: row.class_label ?? '',
    groupLabel: row.group_label ?? '',
    teacherInitial: row.teacher_initial ?? '',
    assignmentName: row.assignment_name ?? '',
    studentNo: row.student_no ?? '',
    classNumber: row.class_number,
    studentName: row.student_name ?? '',
    absRaw: row.abs_raw ?? '',
    active: Boolean(row.active),
    syncedAt: row.synced_at,
  }
}

function rowToDismissal(row: DismissalRow): HomeworkAbsDismissal {
  return {
    id: row.id,
    absItemId: row.abs_item_id,
    academicYearStart: row.academic_year_start,
    studentNo: row.student_no ?? '',
    assignmentName: row.assignment_name ?? '',
    dismissedBy: row.dismissed_by ?? '',
    dismissedAt: row.dismissed_at,
  }
}

function rowToLog(row: LogRow): HomeworkAbsEmailLog {
  return {
    id: row.id,
    absItemId: row.abs_item_id,
    academicYearStart: row.academic_year_start,
    studentNo: row.student_no ?? '',
    studentName: row.student_name ?? '',
    classLabel: row.class_label ?? '',
    groupLabel: row.group_label ?? '',
    assignmentName: row.assignment_name ?? '',
    toEmail: row.to_email ?? '',
    teacherId: row.teacher_id ?? '',
    teacherInitial: row.teacher_initial ?? '',
    status: row.status,
    errorMessage: row.error_message ?? '',
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }
}

/** Normalize Sheet 組別 / whitelist class for comparison. */
export function normalizeGroupKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase()
}

/**
 * Whether a Sheet group belongs to a whitelist class.
 * Matches exact ("7D"), prefix ("7D-FYC"), or EC forms ("G9 EC").
 */
export function groupMatchesWhitelistClass(
  groupLabel: string,
  className: string,
): boolean {
  const group = normalizeGroupKey(groupLabel)
  const cls = normalizeGroupKey(className)
  if (!group || !cls) return false
  if (group === cls) return true
  if (group.startsWith(`${cls}-`)) return true
  if (group.startsWith(`${cls} `)) return true
  return false
}

export function itemMatchesTeacherClasses(
  item: HomeworkAbsItem,
  classNames: string[],
): boolean {
  if (classNames.length === 0) return false
  return classNames.some((name) =>
    groupMatchesWhitelistClass(item.groupLabel, name),
  )
}

export async function fetchHomeworkAbsItems(
  academicYearStart: number,
): Promise<HomeworkAbsItem[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(ITEMS)
    .select('*')
    .eq('academic_year_start', academicYearStart)
    .eq('active', true)
  if (error) {
    console.warn('homework abs fetch failed', error.message)
    return null
  }
  return ((data ?? []) as ItemRow[])
    .map(rowToItem)
    .filter((item) => isAbsMarker(item.absRaw))
}

export async function fetchHomeworkAbsDismissals(
  academicYearStart: number,
): Promise<HomeworkAbsDismissal[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(DISMISSALS)
    .select('*')
    .eq('academic_year_start', academicYearStart)
  if (error) {
    console.warn('homework abs dismissals fetch failed', error.message)
    return null
  }
  return ((data ?? []) as DismissalRow[]).map(rowToDismissal)
}

export async function fetchHomeworkAbsEmailLogs(options?: {
  teacherId?: string
  academicYearStart?: number
  limit?: number
}): Promise<HomeworkAbsEmailLog[] | null> {
  if (!supabase) return null
  let query = supabase
    .from(LOGS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 200)
  if (options?.teacherId) {
    query = query.eq('teacher_id', options.teacherId)
  }
  if (options?.academicYearStart != null) {
    query = query.eq('academic_year_start', options.academicYearStart)
  }
  const { data, error } = await query
  if (error) {
    console.warn('homework abs email logs fetch failed', error.message)
    return null
  }
  return ((data ?? []) as LogRow[]).map(rowToLog)
}

export async function dismissHomeworkAbsItem(input: {
  item: HomeworkAbsItem
  dismissedBy: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: '尚未連線資料庫' }
  const id = `dismiss-${input.item.id}`
  const { error } = await supabase.from(DISMISSALS).upsert(
    {
      id,
      abs_item_id: input.item.id,
      academic_year_start: input.item.academicYearStart,
      student_no: input.item.studentNo,
      assignment_name: input.item.assignmentName,
      dismissed_by: input.dismissedBy,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function queueHomeworkAbsEmail(input: {
  item: HomeworkAbsItem
  toEmail: string
  teacherId: string
  teacherInitial: string
}): Promise<
  { ok: true; log: HomeworkAbsEmailLog } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: '尚未連線資料庫' }
  const id = `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()
  const row = {
    id,
    abs_item_id: input.item.id,
    academic_year_start: input.item.academicYearStart,
    student_no: input.item.studentNo,
    student_name: input.item.studentName,
    class_label: input.item.classLabel,
    group_label: input.item.groupLabel,
    assignment_name: input.item.assignmentName,
    to_email: input.toEmail,
    teacher_id: input.teacherId,
    teacher_initial: input.teacherInitial,
    status: 'queued' as const,
    error_message: '',
    created_at: createdAt,
    sent_at: null,
  }
  const { error } = await supabase.from(LOGS).insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true, log: rowToLog(row) }
}

export async function invokeSendHomeworkAbsEmail(
  logId: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: '尚未連線資料庫' }
  const { data, error } = await supabase.functions.invoke(
    'send-homework-abs-email',
    { body: { logId } },
  )
  if (error) {
    return {
      ok: false,
      error: error.message || '寄信服務呼叫失敗（可稍後由同步程式補寄）',
    }
  }
  const payload = data as { ok?: boolean; status?: string; error?: string } | null
  if (payload?.ok === false) {
    return { ok: false, error: payload.error || '寄信失敗' }
  }
  return { ok: true, status: payload?.status ?? 'sent' }
}

export function newClientId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Stable id for a Sheet ABS row (sync upsert key). */
export function homeworkAbsItemId(input: {
  academicYearStart: number
  studentNo: string
  classLabel: string
  classNumber: number | null
  assignmentName: string
  sheetRow?: number | null
}): string {
  const studentKey =
    input.studentNo.trim() ||
    `${input.classLabel.trim()}#${input.classNumber ?? 'x'}#${input.sheetRow ?? 0}`
  const raw = [
    input.academicYearStart,
    studentKey,
    input.assignmentName.trim(),
  ].join('|')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0
  }
  return `abs-${input.academicYearStart}-${(hash >>> 0).toString(36)}`
}
