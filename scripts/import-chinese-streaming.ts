/**
 * Import 2026/27 Chinese teaching-group assignments (streaming workbooks).
 * Updates students.teaching_group for academic_year_start = 2026.
 *
 * FR (French stream) → that grade's EC class, e.g. G7 EC-WKL.
 *
 *   npm run import:streaming:2627
 *   npm run import:streaming:2627 -- --sql
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import xlsx from 'xlsx'
import { storedStudentNo } from '../src/data/campusScoresYear'
import {
  ecTeachingGroupForGrade,
  gradeNumberFromClassId,
  isEcStreamStudent,
  TEACHER_WHITELIST_2627,
} from '../src/data/teacherWhitelist'

const XLSX = xlsx

config({ path: '.env.local' })
config()

const ACADEMIC_YEAR_START = 2026

const DEFAULT_SOURCES: { file: string; sheet: string }[] = [
  {
    file: '/Users/apple/Downloads/G7_Chinese Streaming (20260829).xlsx',
    sheet: 'G7',
  },
  {
    file: '/Users/apple/Downloads/G8_Chinese Streaming (20260829).xlsx',
    sheet: 'G8',
  },
  {
    file: '/Users/apple/Downloads/G9_Chinese Streaming (20260829).xlsx',
    sheet: 'G9',
  },
  {
    file: '/Users/apple/Downloads/2026-2027高中中文小組完成版V2.xlsx',
    sheet: 'G10',
  },
  {
    file: '/Users/apple/Downloads/2026-2027高中中文小組完成版V2.xlsx',
    sheet: 'G11',
  },
  {
    file: '/Users/apple/Downloads/2026-2027高中中文小組完成版V2.xlsx',
    sheet: 'G12',
  },
]

type StreamingRow = {
  student_no: string
  teaching_group: string
  french: boolean
  source_file: string
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

function gradeFromAdminClass(raw: unknown): number | null {
  const name = excelClassToName(raw)
  if (!name) return null
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

function buildClassToTeacher(): Map<string, string> {
  const map = new Map<string, string>()
  for (const teacher of TEACHER_WHITELIST_2627) {
    for (const className of teacher.classes) {
      if (!map.has(className)) map.set(className, teacher.initial)
    }
  }
  return map
}

function groupNameToTeachingGroup(
  groupName: string,
  adminClassRaw: unknown,
  classToTeacher: Map<string, string>,
): { teaching_group: string; french: boolean } {
  const raw = groupName.trim()
  if (!raw) return { teaching_group: '', french: false }

  if (raw.toUpperCase() === 'FR') {
    const grade = gradeFromAdminClass(adminClassRaw)
    if (grade == null) {
      throw new Error(`FR row missing admin class: ${String(adminClassRaw)}`)
    }
    const teaching_group = ecTeachingGroupForGrade(grade, ACADEMIC_YEAR_START)
    if (!teaching_group) {
      throw new Error(`No G${grade} EC teacher for FR student`)
    }
    return { teaching_group, french: true }
  }

  let className = raw
  const gMatch = raw.match(/^G(\d+)([A-Z]+)$/i)
  if (gMatch) className = `${gMatch[1]}${gMatch[2].toUpperCase()}`

  const initial = classToTeacher.get(className)
  if (initial) return { teaching_group: `${className}-${initial}`, french: false }

  throw new Error(
    `No whitelist teacher for class ${className} (group "${groupName}")`,
  )
}

function parseStreamingSheet(filePath: string, sheetName: string): StreamingRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: false })
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error(`Missing sheet ${sheetName} in ${basename(filePath)}`)

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  if (rows.length < 2) return []

  const classToTeacher = buildClassToTeacher()
  const out: StreamingRow[] = []
  const source = basename(filePath)

  for (const row of rows.slice(1)) {
    const stidRaw = row[0]
    if (stidRaw == null || stidRaw === '') continue
    const stid = String(Math.trunc(Number(stidRaw)) || stidRaw)
    const groupName = String(row[5] ?? '').trim()
    if (!groupName) continue

    const { teaching_group, french } = groupNameToTeachingGroup(
      groupName,
      row[1],
      classToTeacher,
    )
    out.push({
      student_no: storedStudentNo(ACADEMIC_YEAR_START, stid),
      teaching_group,
      french,
      source_file: source,
    })
  }

  return out
}

function parseAllSources(
  sources: { file: string; sheet: string }[],
): Map<string, StreamingRow> {
  const byStudent = new Map<string, StreamingRow>()

  for (const source of sources) {
    const rows = parseStreamingSheet(source.file, source.sheet)
    console.log(
      `  ${basename(source.file)} [${source.sheet}]: ${rows.length} row(s)`,
    )
    for (const row of rows) {
      const prev = byStudent.get(row.student_no)
      if (prev && prev.teaching_group !== row.teaching_group) {
        throw new Error(
          `Conflicting groups for ${row.student_no}: ${prev.teaching_group} vs ${row.teaching_group}`,
        )
      }
      byStudent.set(row.student_no, row)
    }
  }

  return byStudent
}

async function appendFrenchEcFromRoster(
  client: ReturnType<typeof createClient>,
  byStudent: Map<string, StreamingRow>,
) {
  const frenchRows: {
    student_no: string
    class_id: string
    teaching_group: string | null
  }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('students')
      .select('student_no, class_id, teaching_group')
      .eq('academic_year_start', ACADEMIC_YEAR_START)
      .eq('french', true)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    frenchRows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let added = 0
  for (const row of frenchRows) {
    if (isEcStreamStudent({ teachingGroup: row.teaching_group ?? '' })) continue
    const grade = gradeNumberFromClassId(row.class_id)
    if (grade == null) continue
    const teaching_group = ecTeachingGroupForGrade(grade, ACADEMIC_YEAR_START)
    if (!teaching_group) continue
    byStudent.set(row.student_no, {
      student_no: row.student_no,
      teaching_group,
      french: true,
      source_file: 'french→EC',
    })
    added++
  }
  if (added > 0) console.log(`  french→EC roster fill: ${added} row(s)`)
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

function buildUpdateSql(rows: StreamingRow[]): string {
  const lines = [
    '-- 2026/27 Chinese teaching groups (streaming workbooks)',
    `-- ${rows.length} students`,
    '',
  ]
  for (const row of rows) {
    lines.push(
      `update public.students set teaching_group = ${sqlStr(row.teaching_group)}, french = ${row.french}, updated_at = now() where student_no = ${sqlStr(row.student_no)};`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

async function upsertTeachingGroups(
  client: ReturnType<typeof createClient>,
  rows: StreamingRow[],
) {
  const size = 50
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    await Promise.all(
      chunk.map(async (row) => {
        const { error } = await client
          .from('students')
          .update({
            teaching_group: row.teaching_group,
            french: row.french,
          })
          .eq('student_no', row.student_no)
        if (error) throw new Error(`${row.student_no}: ${error.message}`)
      }),
    )
    console.log(`  updated: ${Math.min(i + size, rows.length)}/${rows.length}`)
  }
}

async function main() {
  const sqlOnly = process.argv.includes('--sql')
  const sources = DEFAULT_SOURCES

  console.log(
    `Academic year ${ACADEMIC_YEAR_START}/${String(ACADEMIC_YEAR_START + 1).slice(-2)} — Chinese streaming groups`,
  )
  console.log('Reading workbooks…')
  const byStudent = parseAllSources(sources)

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sqlOnly && serviceKey && url) {
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await appendFrenchEcFromRoster(client, byStudent)
    const rows = [...byStudent.values()]
    console.log(`Prepared ${rows.length} teaching_group update(s)`)
    console.log('\nUpdating students…')
    await upsertTeachingGroups(client, rows)
    console.log('Done.')
    return
  }

  const rows = [...byStudent.values()]
  console.log(`Prepared ${rows.length} teaching_group update(s)`)

  if (sqlOnly || !serviceKey || !url) {
    mkdirSync('scripts/out', { recursive: true })
    const path = 'scripts/out/seed-chinese-streaming-2627.sql'
    writeFileSync(path, buildUpdateSql(rows), 'utf8')
    console.log(`Wrote ${path}`)
    return
  }

  console.log('Tip: add SUPABASE_SERVICE_ROLE_KEY to .env.local to upsert via API.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
