/**
 * Import 2025/26 Chinese score workbooks into Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-chinese-scores.ts
 *
 * Defaults to Downloads folders for 上學期 / 下學期 workbooks.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import xlsx from 'xlsx'

const XLSX = xlsx

config({ path: '.env.local' })
config()

const ACADEMIC_YEAR_START = 2025

const DEFAULT_SOURCES: { semester: 'first' | 'second'; dir: string }[] = [
  { semester: 'first', dir: '/Users/apple/Downloads/01. 上學期' },
  {
    semester: 'second',
    dir: '/Users/apple/Downloads/02. 下學期/01. 各級入分檔',
  },
]

type ClassRow = { id: string; name: string; grade: number }
type StudentRow = {
  student_no: string
  class_id: string
  class_number: number
  name_zh: string
  name_en: string
  teaching_group: string
  academic_year_start: number
}
type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: 'first' | 'second'
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string>
  attitude_grade: string
  remarks: string
  source_file: string
}

function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

/** Excel Class cell → canonical name used by the app (7D, G7 EC). */
function excelClassToName(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().replace(/\s+/g, ' ')
  const ec = s.match(/^G?\s*(\d+)\s*EC$/i)
  if (ec) return `G${ec[1]} EC`
  const form = s.match(/^G?(\d+)([A-Za-z])$/i)
  if (form) return `${form[1]}${form[2].toUpperCase()}`
  return s
}

function gradeFromClassName(name: string): number | null {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

function normHeader(h: unknown): string {
  return String(h ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/%/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 100) / 100
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function findKey(
  components: Record<string, number | string>,
  predicates: ((k: string) => boolean)[],
): number | null {
  for (const pred of predicates) {
    for (const [k, v] of Object.entries(components)) {
      if (!pred(k)) continue
      const n = typeof v === 'number' ? v : toNum(v)
      if (n != null) return n
    }
  }
  return null
}

function findAll(
  components: Record<string, number | string>,
  pred: (k: string) => boolean,
): number[] {
  const out: number[] = []
  for (const [k, v] of Object.entries(components)) {
    if (!pred(k)) continue
    const n = typeof v === 'number' ? v : toNum(v)
    if (n != null) out.push(n)
  }
  return out
}

/** Map Excel component scores → daily / reading / writing (0–100). */
function deriveScores(components: Record<string, number | string>): {
  daily: number
  reading: number
  writing: number
} {
  const paper1 =
    findKey(components, [
      (k) => k.includes('卷一') && !k.includes('乙') && !k.includes('甲'),
      (k) => k === '卷一%' || k.startsWith('卷一'),
    ]) ??
    avg(
      findAll(
        components,
        (k) => k.includes('卷一') && (k.includes('甲') || k.includes('乙')),
      ),
    )

  const paper2 =
    findKey(components, [
      (k) => k.includes('卷二') && !k.includes('乙') && !k.includes('甲'),
      (k) => k === '卷二%' || k.startsWith('卷二'),
    ]) ??
    avg(
      findAll(
        components,
        (k) => k.includes('卷二') && (k.includes('甲') || k.includes('乙')),
      ),
    )

  const essays = findAll(
    components,
    (k) =>
      (k.includes('作文') || k.includes('實用寫作')) &&
      !k.includes('等第') &&
      !k.includes('remarks'),
  )
  const writing = paper2 ?? avg(essays) ?? 0

  const readingReports = findAll(components, (k) => k.includes('閱讀報告'))
  const listening = findAll(components, (k) => k.includes('聆聽'))
  const quiz = findAll(components, (k) => k.includes('測驗') || k.includes('統測'))
  const speaking = findAll(components, (k) => k.includes('說話'))
  const attitude = findAll(
    components,
    (k) => k.includes('學習態度') && !k.includes('等第'),
  )

  // Normalize attitude (often /5) and speaking (often /2) toward 0–100.
  const attitudePct = attitude.map((n) => (n <= 5 ? (n / 5) * 100 : n))
  const speakingPct = speaking.map((n) => (n <= 2 ? (n / 2) * 100 : n))
  const quizPct = quiz.map((n) => (n <= 45 ? (n / 45) * 100 : n <= 100 ? n : n))
  const listenPct = listening.map((n) => (n <= 20 ? (n / 20) * 100 : n))
  const reportPct = readingReports.map((n) => (n <= 10 ? (n / 10) * 100 : n))

  const dailyParts = [
    ...attitudePct,
    ...reportPct,
    ...listenPct,
    ...quizPct,
    ...speakingPct,
  ]
  const daily = avg(dailyParts) ?? 0
  const reading = paper1 ?? avg(reportPct) ?? 0

  return {
    daily: clamp100(daily),
    reading: clamp100(reading),
    writing: clamp100(writing),
  }
}

function sheetToMatrix(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
}

function parseNameList(wb: XLSX.WorkBook): {
  students: StudentRow[]
  classes: Map<string, ClassRow>
} {
  const rows = sheetToMatrix(wb, 'NameList')
  if (rows.length < 2) return { students: [], classes: new Map() }

  const header = rows[0].map(normHeader)
  const idx = (aliases: string[]) =>
    header.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))

  const iNo = idx(['student no', 'student_no', '學號'])
  const iClass = idx(['class'])
  const iClassNo = idx(['class no', 'class_no', '班號'])
  const iEName = idx(['ename', 'english'])
  const iCName = idx(['cname', '中文'])
  const iGroup = idx(['group'])
  // Prefer the Group column (7D-FYC), not "Group Name" (house).
  const groupCol =
    header.findIndex((h) => h === 'group') >= 0
      ? header.findIndex((h) => h === 'group')
      : iGroup

  const classes = new Map<string, ClassRow>()
  const students: StudentRow[] = []

  for (const row of rows.slice(1)) {
    const studentNo = row[iNo]
    if (studentNo == null || studentNo === '') continue
    const className = excelClassToName(row[iClass])
    if (!className) continue
    const grade = gradeFromClassName(className)
    if (grade == null) continue
    const id = classNameToId(className)
    classes.set(id, { id, name: className, grade })

    const classNumber = toNum(row[iClassNo]) ?? 0
    const nameZh = String(row[iCName] ?? '').trim()
    if (!nameZh) continue

    students.push({
      student_no: String(Math.trunc(Number(studentNo)) || studentNo),
      class_id: id,
      class_number: classNumber,
      name_zh: nameZh,
      name_en: String(row[iEName] ?? '').trim(),
      teaching_group: String(row[groupCol] ?? '').trim(),
      academic_year_start: ACADEMIC_YEAR_START,
    })
  }

  return { students, classes }
}

function parseOverallScore(
  wb: XLSX.WorkBook,
  semester: 'first' | 'second',
  sourceFile: string,
  classById: Map<string, ClassRow>,
): SemesterRow[] {
  const rows = sheetToMatrix(wb, 'OverallScore')
  if (rows.length < 3) return []

  // Row1 = labels, Row2 = max marks / field names for identity cols
  const labelRow = rows[0]
  const metaRow = rows[1]
  const identityHeaders = metaRow.slice(0, 7).map(normHeader)

  const iClass = identityHeaders.findIndex((h) => h === 'class')
  const iClassNo = identityHeaders.findIndex((h) => h.includes('class no'))
  const iCName = identityHeaders.findIndex((h) => h === 'cname')
  const iNo = identityHeaders.findIndex((h) => h.includes('student'))

  const records: SemesterRow[] = []

  for (const row of rows.slice(2)) {
    const studentNoRaw = row[iNo >= 0 ? iNo : 4]
    if (studentNoRaw == null || studentNoRaw === '') continue
    const student_no = String(
      Math.trunc(Number(studentNoRaw)) || studentNoRaw,
    )
    const className = excelClassToName(row[iClass >= 0 ? iClass : 0])
    if (!className) continue
    const grade =
      gradeFromClassName(className) ??
      classById.get(classNameToId(className))?.grade
    if (grade == null) continue

    const components: Record<string, number | string> = {}
    for (let c = 7; c < Math.max(labelRow.length, row.length); c++) {
      const label = normHeader(labelRow[c] || metaRow[c])
      if (!label || label === 'other') continue
      const val = row[c]
      if (val == null || val === '') continue
      const n = toNum(val)
      if (n != null) components[label] = n
      else components[label] = String(val)
    }

    const attitude_grade = String(
      components[
        Object.keys(components).find((k) => k.includes('學習態度等第')) ?? ''
      ] ?? '',
    )
    const remarks = String(
      components[
        Object.keys(components).find((k) => k.includes('remarks') || k.includes('欠交')) ??
          ''
      ] ?? '',
    )

    const scores = deriveScores(components)
    records.push({
      student_no,
      academic_year_start: ACADEMIC_YEAR_START,
      grade,
      semester,
      ...scores,
      components,
      attitude_grade,
      remarks,
      source_file: sourceFile,
    })

    // silence unused
    void iClassNo
    void iCName
  }

  return records
}

function listWorkbooks(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /中文科.*入分檔.*\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map((f) => join(dir, f))
    .sort()
}

async function upsertChunks<T extends Record<string, unknown>>(
  client: ReturnType<typeof createClient>,
  table: string,
  rows: T[],
  onConflict: string,
) {
  const size = 200
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await client.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(`${table} upsert failed: ${error.message}`)
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`)
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sqlOnly = process.argv.includes('--sql')

  const classMap = new Map<string, ClassRow>()
  const studentMap = new Map<string, StudentRow>()
  const semesterRows: SemesterRow[] = []

  for (const source of DEFAULT_SOURCES) {
    const files = listWorkbooks(source.dir)
    console.log(`\n${source.semester}: ${files.length} file(s) in ${source.dir}`)
    for (const file of files) {
      console.log(`  reading ${basename(file)}`)
      const wb = XLSX.readFile(file, { cellDates: false })
      const { students, classes } = parseNameList(wb)
      for (const [id, cls] of classes) classMap.set(id, cls)
      for (const s of students) studentMap.set(s.student_no, s)
      const scores = parseOverallScore(
        wb,
        source.semester,
        basename(file),
        classMap,
      )
      semesterRows.push(...scores)
      console.log(`    namelist=${students.length} scores=${scores.length}`)
    }
  }

  const classes = [...classMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  )
  const students = [...studentMap.values()]
  const linkedSemesterRows = semesterRows.filter((r) =>
    studentMap.has(r.student_no),
  )
  const skipped = semesterRows.length - linkedSemesterRows.length
  if (skipped > 0) {
    console.warn(`Skipping ${skipped} score rows with no NameList student`)
  }

  console.log(
    `\nPrepared classes=${classes.length} students=${students.length} semester_records=${linkedSemesterRows.length}`,
  )

  if (sqlOnly || !serviceKey || !url) {
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync('scripts/out', { recursive: true })
    const sqlPath = 'scripts/out/seed-chinese-scores.sql'
    writeFileSync(
      sqlPath,
      buildSeedSql(classes, students, linkedSemesterRows),
      'utf8',
    )
    console.log(`\nWrote ${sqlPath}`)
    console.log(
      'Open Supabase → SQL Editor, run supabase/migrations/20260822010000_campus_scores.sql first,',
    )
    console.log('then run scripts/out/seed-chinese-scores.sql')
    if (!serviceKey) {
      console.log(
        '\nTip: add SUPABASE_SERVICE_ROLE_KEY to .env.local to upsert via API instead.',
      )
    }
    return
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('\nUpserting via service role…')
  await upsertChunks(client, 'classes', classes, 'id')
  await upsertChunks(client, 'students', students, 'student_no')
  await upsertChunks(
    client,
    'semester_records',
    linkedSemesterRows.map((row) => ({ ...row })),
    'student_no,academic_year_start,semester',
  )

  console.log('\nDone.')
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

function buildSeedSql(
  classes: ClassRow[],
  students: StudentRow[],
  semesterRows: SemesterRow[],
): string {
  const lines: string[] = [
    '-- Auto-generated 2025/26 Chinese scores seed',
    '-- Run AFTER supabase/migrations/20260822010000_campus_scores.sql',
    '',
  ]

  lines.push('insert into public.classes (id, name, grade) values')
  lines.push(
    classes
      .map((c) => `  (${sqlStr(c.id)}, ${sqlStr(c.name)}, ${c.grade})`)
      .join(',\n'),
  )
  lines.push('on conflict (id) do update set name = excluded.name, grade = excluded.grade;')
  lines.push('')

  lines.push(
    'insert into public.students (student_no, class_id, class_number, name_zh, name_en, teaching_group, academic_year_start) values',
  )
  lines.push(
    students
      .map(
        (s) =>
          `  (${sqlStr(s.student_no)}, ${sqlStr(s.class_id)}, ${s.class_number}, ${sqlStr(s.name_zh)}, ${sqlStr(s.name_en)}, ${sqlStr(s.teaching_group)}, ${s.academic_year_start})`,
      )
      .join(',\n'),
  )
  lines.push(
    'on conflict (student_no) do update set class_id = excluded.class_id, class_number = excluded.class_number, name_zh = excluded.name_zh, name_en = excluded.name_en, teaching_group = excluded.teaching_group, academic_year_start = excluded.academic_year_start, updated_at = now();',
  )
  lines.push('')

  // Chunk semester inserts to keep editor responsive
  const chunk = 150
  for (let i = 0; i < semesterRows.length; i += chunk) {
    const part = semesterRows.slice(i, i + chunk)
    lines.push(
      'insert into public.semester_records (student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks, source_file) values',
    )
    lines.push(
      part
        .map((r) => {
          const json = JSON.stringify(r.components).replace(/'/g, "''")
          return `  (${sqlStr(r.student_no)}, ${r.academic_year_start}, ${r.grade}, ${sqlStr(r.semester)}, ${r.daily}, ${r.reading}, ${r.writing}, '${json}'::jsonb, ${sqlStr(r.attitude_grade)}, ${sqlStr(r.remarks)}, ${sqlStr(r.source_file)})`
        })
        .join(',\n'),
    )
    lines.push(
      'on conflict (student_no, academic_year_start, semester) do update set grade = excluded.grade, daily = excluded.daily, reading = excluded.reading, writing = excluded.writing, components = excluded.components, attitude_grade = excluded.attitude_grade, remarks = excluded.remarks, source_file = excluded.source_file, updated_at = now();',
    )
    lines.push('')
  }

  return lines.join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
