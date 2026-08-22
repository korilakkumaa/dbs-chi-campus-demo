/**
 * Import official 2025/26 student name list (ALL sheet) into Supabase.
 *
 *   node --import tsx scripts/import-student-roster.ts --sql
 *   SUPABASE_SERVICE_ROLE_KEY=... node --import tsx scripts/import-student-roster.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import xlsx from 'xlsx'

const XLSX = xlsx

config({ path: '.env.local' })
config()

const ACADEMIC_YEAR_START = 2025 // 2025/26 roster only — see src/data/campusScoresYear.ts
const DEFAULT_PATH =
  '/Users/apple/Downloads/Student Name List 2025-26_27Feb26 (ALL Only).xlsx'

type ClassRow = { id: string; name: string; grade: number }
type StudentRow = {
  student_no: string
  class_id: string
  class_number: number
  name_zh: string
  name_en: string
  house: string
  french: boolean
  roster_remarks: string
  academic_year_start: number
}

function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

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

function appendChineseStreamClasses(classMap: Map<string, ClassRow>) {
  for (const grade of [7, 8, 9] as const) {
    const name = `${grade}R`
    const id = classNameToId(name)
    classMap.set(id, { id, name, grade })
  }
  classMap.set(classNameToId('10A'), {
    id: classNameToId('10A'),
    name: '10A',
    grade: 10,
  })
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

function parseAllSheet(filePath: string): {
  classes: ClassRow[]
  students: StudentRow[]
} {
  const wb = XLSX.readFile(filePath, { cellDates: false })
  const sheet = wb.Sheets['ALL']
  if (!sheet) throw new Error('Missing ALL sheet')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  if (rows.length < 2) return { classes: [], students: [] }

  const classMap = new Map<string, ClassRow>()
  const students: StudentRow[] = []

  for (const row of rows.slice(1)) {
    const stid = row[4]
    if (stid == null || stid === '') continue
    const className = excelClassToName(row[0])
    if (!className) continue
    const grade = gradeFromClassName(className)
    if (grade == null) continue
    const id = classNameToId(className)
    classMap.set(id, { id, name: className, grade })

    const nameZh = String(row[3] ?? '').trim()
    if (!nameZh) continue

    students.push({
      student_no: String(Math.trunc(Number(stid)) || stid),
      class_id: id,
      class_number: toNum(row[1]) ?? 0,
      name_zh: nameZh,
      name_en: String(row[2] ?? '').trim(),
      house: String(row[5] ?? '').trim(),
      french: Boolean(row[6] && String(row[6]).trim() !== ''),
      roster_remarks: String(row[8] ?? '').trim(),
      academic_year_start: ACADEMIC_YEAR_START,
    })
  }

  appendChineseStreamClasses(classMap)

  return {
    classes: [...classMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    ),
    students,
  }
}

function buildSql(classes: ClassRow[], students: StudentRow[]): string {
  const lines: string[] = [
    '-- Official 2025/26 student name list (ALL)',
    '-- Run AFTER 20260822013000_student_roster_fields.sql',
    '',
    'insert into public.classes (id, name, grade) values',
    classes
      .map((c) => `  (${sqlStr(c.id)}, ${sqlStr(c.name)}, ${c.grade})`)
      .join(',\n'),
    'on conflict (id) do update set name = excluded.name, grade = excluded.grade;',
    '',
    'insert into public.students (student_no, class_id, class_number, name_zh, name_en, house, french, roster_remarks, academic_year_start) values',
  ]

  lines.push(
    students
      .map(
        (s) =>
          `  (${sqlStr(s.student_no)}, ${sqlStr(s.class_id)}, ${s.class_number}, ${sqlStr(s.name_zh)}, ${sqlStr(s.name_en)}, ${sqlStr(s.house)}, ${s.french}, ${sqlStr(s.roster_remarks)}, ${s.academic_year_start})`,
      )
      .join(',\n'),
  )
  lines.push(`on conflict (student_no) do update set
  class_id = excluded.class_id,
  class_number = excluded.class_number,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  house = excluded.house,
  french = excluded.french,
  roster_remarks = excluded.roster_remarks,
  academic_year_start = excluded.academic_year_start,
  updated_at = now();`)
  lines.push('')
  return lines.join('\n')
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
    if (error) throw new Error(`${table}: ${error.message}`)
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`)
  }
}

async function main() {
  const filePath = process.argv.find((a) => a.endsWith('.xlsx')) ?? DEFAULT_PATH
  const sqlOnly = process.argv.includes('--sql')
  console.log('Reading', basename(filePath))
  const { classes, students } = parseAllSheet(filePath)
  console.log(`classes=${classes.length} students=${students.length}`)

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (sqlOnly || !serviceKey || !url) {
    mkdirSync('scripts/out', { recursive: true })
    const full = 'scripts/out/seed-student-roster.sql'
    writeFileSync(full, buildSql(classes, students), 'utf8')
    const partDir = 'scripts/out/roster-parts'
    mkdirSync(partDir, { recursive: true })
    writeFileSync(
      `${partDir}/00-classes.sql`,
      [
        '-- Official 2025/26 classes from student name list',
        '-- Run AFTER 20260822013000_student_roster_fields.sql',
        '',
        'insert into public.classes (id, name, grade) values',
        classes
          .map((c) => `  (${sqlStr(c.id)}, ${sqlStr(c.name)}, ${c.grade})`)
          .join(',\n'),
        'on conflict (id) do update set name = excluded.name, grade = excluded.grade;',
        '',
      ].join('\n'),
      'utf8',
    )
    const chunk = 300
    for (let i = 0; i < students.length; i += chunk) {
      const part = students.slice(i, i + chunk)
      const n = Math.floor(i / chunk) + 1
      const body = [
        `insert into public.students (student_no, class_id, class_number, name_zh, name_en, house, french, roster_remarks, academic_year_start) values`,
        part
          .map(
            (s) =>
              `  (${sqlStr(s.student_no)}, ${sqlStr(s.class_id)}, ${s.class_number}, ${sqlStr(s.name_zh)}, ${sqlStr(s.name_en)}, ${sqlStr(s.house)}, ${s.french}, ${sqlStr(s.roster_remarks)}, ${s.academic_year_start})`,
          )
          .join(',\n'),
        `on conflict (student_no) do update set
  class_id = excluded.class_id,
  class_number = excluded.class_number,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  house = excluded.house,
  french = excluded.french,
  roster_remarks = excluded.roster_remarks,
  academic_year_start = excluded.academic_year_start,
  updated_at = now();`,
        '',
      ].join('\n')
      writeFileSync(
        `${partDir}/${String(n).padStart(2, '0')}-students.sql`,
        body,
        'utf8',
      )
    }
    console.log(`Wrote ${full} and ${partDir}/`)
    return
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  await upsertChunks(client, 'classes', classes, 'id')
  await upsertChunks(client, 'students', students, 'student_no')
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
