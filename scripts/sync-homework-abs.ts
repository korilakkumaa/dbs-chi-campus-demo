/**
 * Sync homework ABS rows from a Google Sheet (published CSV) into Supabase.
 *
 * Env:
 *   HOMEWORK_ABS_SHEET_CSV_URL  — File → Share → Publish to web → CSV
 *   or HOMEWORK_ABS_SHEET_CSV_PATH — local CSV for testing
 *   HOMEWORK_ABS_ACADEMIC_YEAR  — optional; default = current academic year
 *
 * Expected columns (Chinese or English aliases):
 *   學生班別 / 班別 / class
 *   學生組別 / 組別 / group
 *   任教老師 / INITIAL / teacher
 *   習作名稱 / 習作 / assignment
 *   ABS / 狀態 / status          (value "abs", case-insensitive)
 *   學生編號 / STID / student_no (optional but preferred)
 *   學號 / class_number          (optional)
 *   姓名 / name                  (optional)
 *
 *   npm run sync:homework-abs
 *   npm run sync:homework-abs -- --process-mail
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { academicYearStartYear } from '../src/data/academicYear'
import { storedStudentNo } from '../src/data/campusScoresYear'
import { isAbsMarker } from '../src/data/studentEmail'
import { latestTeacherWhitelistYear } from '../src/data/teacherWhitelist'

config({ path: '.env.local' })
config()

const ITEMS = 'homework_abs_items'

type ParsedRow = {
  classLabel: string
  groupLabel: string
  teacherInitial: string
  assignmentName: string
  absRaw: string
  studentNoOfficial: string
  classNumber: number | null
  studentName: string
  sheetRow: number
}

function resolveYear(): number {
  const flag = process.argv.find((a) => a.startsWith('--year='))
  const raw =
    flag?.slice('--year='.length) ?? process.env.HOMEWORK_ABS_ACADEMIC_YEAR
  if (raw) {
    const year = Number(raw)
    if (!Number.isFinite(year)) throw new Error(`Invalid year: ${raw}`)
    return Math.trunc(year)
  }
  try {
    return latestTeacherWhitelistYear()
  } catch {
    return academicYearStartYear()
  }
}

function cell(row: Record<string, string>, aliases: string[]): string {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const needle = alias.trim().toLowerCase()
    const hit = keys.find((k) => k.trim().toLowerCase() === needle)
    if (hit && row[hit]?.trim()) return row[hit].trim()
  }
  for (const alias of aliases) {
    const needle = alias.trim().toLowerCase()
    const hit = keys.find((k) => k.trim().toLowerCase().includes(needle))
    if (hit && row[hit]?.trim()) return row[hit].trim()
  }
  return ''
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((c) => c.trim())) rows.push(row)
  }
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cols) => {
    const out: Record<string, string> = {}
    headers.forEach((h, idx) => {
      out[h] = (cols[idx] ?? '').trim()
    })
    return out
  })
}

function parseClassNumber(raw: string): number | null {
  const n = Number(String(raw).replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function itemId(parts: {
  year: number
  studentKey: string
  assignment: string
}): string {
  const raw = `${parts.year}|${parts.studentKey}|${parts.assignment}`
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 16)
  return `abs-${parts.year}-${hash}`
}

function toParsed(rows: Record<string, string>[]): ParsedRow[] {
  const out: ParsedRow[] = []
  rows.forEach((row, idx) => {
    const absRaw = cell(row, ['ABS', '狀態', 'status', '欠交'])
    if (!isAbsMarker(absRaw)) return
    const assignmentName = cell(row, [
      '習作名稱',
      '習作',
      'assignment',
      'homework',
    ])
    if (!assignmentName) return
    out.push({
      classLabel: cell(row, ['學生班別', '班別', 'class', '行政班']),
      groupLabel: cell(row, ['學生組別', '組別', 'group', '中文組']),
      teacherInitial: cell(row, [
        '任教老師',
        'INITIAL',
        '老師',
        'teacher',
        'initial',
      ]).toUpperCase(),
      assignmentName,
      absRaw,
      studentNoOfficial: cell(row, [
        '學生編號',
        'STID',
        'student_no',
        '學籍編號',
      ]),
      classNumber: parseClassNumber(cell(row, ['學號', 'class_number', '班號'])),
      studentName: cell(row, ['姓名', 'name', '中文名', 'name_zh']),
      sheetRow: idx + 2,
    })
  })
  return out
}

async function loadCsvText(): Promise<string> {
  const path = process.env.HOMEWORK_ABS_SHEET_CSV_PATH?.trim()
  if (path) return readFileSync(path, 'utf8')
  const url = process.env.HOMEWORK_ABS_SHEET_CSV_URL?.trim()
  if (!url) {
    throw new Error(
      'Set HOMEWORK_ABS_SHEET_CSV_URL or HOMEWORK_ABS_SHEET_CSV_PATH',
    )
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sheet CSV fetch failed: ${res.status}`)
  return await res.text()
}

async function processQueuedMail(
  client: ReturnType<typeof createClient>,
): Promise<void> {
  const { processQueuedHomeworkAbsEmails } = await import(
    './lib/processHomeworkAbsEmails'
  )
  const result = await processQueuedHomeworkAbsEmails(client)
  console.log(
    `mail: sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
  )
}

async function main() {
  const year = resolveYear()
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  const client = createClient(url, key)

  const text = await loadCsvText()
  const parsed = toParsed(parseCsv(text))
  const now = new Date().toISOString()

  const rows = parsed.map((p) => {
    const official = p.studentNoOfficial.trim()
    const studentNo = official ? storedStudentNo(year, official) : ''
    const studentKey =
      studentNo ||
      `${p.classLabel}#${p.classNumber ?? 'x'}#${p.sheetRow}`
    return {
      id: itemId({
        year,
        studentKey,
        assignment: p.assignmentName,
      }),
      academic_year_start: year,
      class_label: p.classLabel,
      group_label: p.groupLabel,
      teacher_initial: p.teacherInitial,
      assignment_name: p.assignmentName,
      student_no: studentNo,
      class_number: p.classNumber,
      student_name: p.studentName,
      abs_raw: p.absRaw,
      sheet_row: p.sheetRow,
      active: true,
      synced_at: now,
      updated_at: now,
    }
  })

  // Enrich missing student_no / name from roster (class_id + class_number).
  const needEnrich = rows.some((r) => !r.student_no || !r.student_name)
  if (needEnrich) {
    const { data: roster, error: rosterErr } = await client
      .from('students')
      .select('student_no, class_id, class_number, name_zh, teaching_group')
      .eq('academic_year_start', year)
    if (rosterErr) {
      console.warn('roster enrich skipped:', rosterErr.message)
    } else {
      type RosterHit = {
        student_no: string
        class_id: string
        class_number: number
        name_zh: string
        teaching_group: string | null
      }
      const list = (roster ?? []) as RosterHit[]
      for (const row of rows) {
        if (row.student_no && row.student_name) continue
        const classKey = row.class_label
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
        const hits = list.filter((s) => {
          if (row.class_number != null && s.class_number !== row.class_number) {
            return false
          }
          const cid = s.class_id.replace(/^c-/, '').toLowerCase()
          if (classKey && (cid === classKey || cid.startsWith(classKey))) {
            return true
          }
          const tg = (s.teaching_group ?? '').toUpperCase()
          const group = row.group_label.trim().toUpperCase()
          if (group && (tg === group || tg.startsWith(`${group}-`))) {
            return row.class_number == null || s.class_number === row.class_number
          }
          return false
        })
        const hit =
          hits.length === 1
            ? hits[0]
            : hits.find(
                (s) =>
                  row.class_number != null &&
                  s.class_number === row.class_number,
              ) ?? null
        if (!hit) continue
        if (!row.student_no) row.student_no = hit.student_no
        if (!row.student_name) row.student_name = hit.name_zh || ''
      }
    }
  }

  const activeIds = new Set(rows.map((r) => r.id))

  if (rows.length > 0) {
    const { error } = await client.from(ITEMS).upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }

  const { data: existing, error: listErr } = await client
    .from(ITEMS)
    .select('id')
    .eq('academic_year_start', year)
    .eq('active', true)
  if (listErr) throw new Error(listErr.message)

  const toDeactivate = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !activeIds.has(id))
  if (toDeactivate.length > 0) {
    const { error } = await client
      .from(ITEMS)
      .update({ active: false, updated_at: now })
      .in('id', toDeactivate)
    if (error) throw new Error(error.message)
  }

  console.log(
    `sync year=${year}: upserted=${rows.length} deactivated=${toDeactivate.length}`,
  )

  if (process.argv.includes('--process-mail')) {
    await processQueuedMail(client)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
