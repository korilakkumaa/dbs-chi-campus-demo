/**
 * Copy 2024/25 semester_records onto 2026/27 roster student_no rows
 * so 分數-個人 can show prior years before 2627 workbooks are imported.
 *
 *   npm run sync:prior-scores:2627
 *   npm run sync:prior-scores:2627 -- --sql
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  officialStudentNo,
  storedStudentNo,
} from '../src/data/campusScoresYear'

config({ path: '.env.local' })
config()

const TARGET_YEAR = 2026
const SOURCE_YEARS = [2024, 2025] as const
const PAGE = 1000

type StudentRow = {
  student_no: string
  class_id: string
  class_number: number
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

async function fetchAll<T>(
  label: string,
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const { data, error } = await build(from, to)
    if (error) throw new Error(`${label}: ${error.message}`)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

function gradeFromClassId(classId: string): number | null {
  const match = classId.match(/^c-g?(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function priorClassId(classId: string, yearOffset: number): string | null {
  const match = classId.match(/^(c-)(\d+)(.*)$/i)
  if (!match || yearOffset <= 0) return null
  const grade = Number(match[2]) - yearOffset
  if (grade < 7 || grade > 12) return null
  return `${match[1]}${grade}${match[3]}`
}

function mappedGradeForRecord(
  current: StudentRow,
  recordYear: number,
  sourceGrade: number,
): number {
  const currentGrade = gradeFromClassId(current.class_id)
  if (currentGrade == null) return sourceGrade
  const offset = TARGET_YEAR - recordYear
  if (offset <= 0) return sourceGrade
  const mapped = currentGrade - offset
  return mapped >= 7 && mapped <= 12 ? mapped : sourceGrade
}

function isExpectedGrade(anchor: StudentRow, hit: StudentRow): boolean {
  const from = gradeFromClassId(anchor.class_id)
  const to = gradeFromClassId(hit.class_id)
  if (from == null || to == null) return true
  return to === from + (hit.academic_year_start - anchor.academic_year_start)
}

function matchByClassAndNumber(
  anchor: StudentRow,
  rows: StudentRow[],
): StudentRow | null {
  if (anchor.class_number <= 0) return null
  const hits = rows.filter(
    (row) =>
      row.class_id === anchor.class_id &&
      row.class_number === anchor.class_number,
  )
  const expected = hits.filter((hit) => isExpectedGrade(anchor, hit))
  if (expected.length === 1) return expected[0]
  return null
}

function matchByPromotedClass(
  anchor: StudentRow,
  priorYear: number,
  rows: StudentRow[],
): StudentRow | null {
  const offset = TARGET_YEAR - priorYear
  if (offset <= 0 || anchor.class_number <= 0) return null
  const priorClass = priorClassId(anchor.class_id, offset)
  if (!priorClass) return null
  const hits = rows.filter(
    (row) =>
      row.class_id === priorClass &&
      row.class_number === anchor.class_number,
  )
  const expected = hits.filter((hit) => isExpectedGrade(anchor, hit))
  return expected.length === 1 ? expected[0] : null
}

function priorStudentNos(official: string, year: number): string[] {
  const nos = [official]
  if (year !== 2025) nos.push(storedStudentNo(year, official))
  return [...new Set(nos)]
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sqlOnly = process.argv.includes('--sql')

  if (!sqlOnly && (!url || !serviceKey)) {
    console.error('Need SUPABASE_SERVICE_ROLE_KEY (or pass --sql)')
    process.exit(1)
  }

  const client = url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

  const roster = await fetchAll<StudentRow>('students', (from, to) => {
    if (!client) return Promise.resolve({ data: [], error: null })
    return client
      .from('students')
      .select('student_no, class_id, class_number, academic_year_start')
      .eq('academic_year_start', TARGET_YEAR)
      .range(from, to)
  })

  const studentsByYear = new Map<number, StudentRow[]>()
  for (const year of SOURCE_YEARS) {
    const rows = await fetchAll<StudentRow>(`students ${year}`, (from, to) => {
      if (!client) return Promise.resolve({ data: [], error: null })
      return client
        .from('students')
        .select('student_no, class_id, class_number, academic_year_start')
        .eq('academic_year_start', year)
        .range(from, to)
    })
    studentsByYear.set(year, rows)
  }

  const sourceRecords = await fetchAll<SemesterRow>(
    'semester_records',
    (from, to) => {
      if (!client) return Promise.resolve({ data: [], error: null })
      return client
        .from('semester_records')
        .select(
          'student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks, source_file',
        )
        .in('academic_year_start', [...SOURCE_YEARS])
        .range(from, to)
    },
  )

  const recordsByKey = new Map<string, SemesterRow[]>()
  for (const row of sourceRecords) {
    const key = `${row.student_no}|${row.academic_year_start}`
    const list = recordsByKey.get(key) ?? []
    list.push(row)
    recordsByKey.set(key, list)
  }

  const copies: SemesterRow[] = []
  const seen = new Set<string>()
  let stidHits = 0
  let classHits = 0

  for (const current of roster) {
    const official = officialStudentNo(current.student_no)
    let anchor: StudentRow = current

    for (const year of [...SOURCE_YEARS].sort((a, b) => b - a)) {
      const yearStudents = studentsByYear.get(year) ?? []
      let sourceNo: string | null = null

      const stidMatch = yearStudents.filter(
        (row) => officialStudentNo(row.student_no) === official,
      )
      if (stidMatch.length === 1) {
        sourceNo = stidMatch[0].student_no
        anchor = stidMatch[0]
        stidHits++
      } else {
        const classMatch =
          matchByPromotedClass(current, year, yearStudents) ??
          matchByPromotedClass(anchor, year, yearStudents) ??
          matchByClassAndNumber(anchor, yearStudents) ??
          matchByClassAndNumber(current, yearStudents)
        if (classMatch) {
          sourceNo = classMatch.student_no
          anchor = classMatch
          classHits++
        }
      }

      if (!sourceNo) continue

      for (const no of priorStudentNos(officialStudentNo(sourceNo), year)) {
        const key = `${no}|${year}`
        for (const rec of recordsByKey.get(key) ?? []) {
          const dedupe = `${current.student_no}|${rec.academic_year_start}|${rec.semester}`
          if (seen.has(dedupe)) continue
          seen.add(dedupe)
          copies.push({
            ...rec,
            student_no: current.student_no,
            grade: mappedGradeForRecord(current, rec.academic_year_start, rec.grade),
            source_file: `sync2627:${rec.source_file || rec.academic_year_start}`,
          })
        }
      }
    }
  }

  console.log(
    `Prepared ${copies.length} semester_records for ${roster.length} students (${TARGET_YEAR}/27 roster)`,
  )
  console.log(`  STID matches: ${stidHits}, class+number fallbacks: ${classHits}`)

  const byYear = new Map<number, number>()
  for (const row of copies) {
    byYear.set(row.academic_year_start, (byYear.get(row.academic_year_start) ?? 0) + 1)
  }
  for (const [year, count] of [...byYear.entries()].sort()) {
    console.log(`  academic_year_start=${year}: ${count} rows`)
  }

  if (sqlOnly || !client) {
    mkdirSync('scripts/out', { recursive: true })
    const path = 'scripts/out/sync-prior-scores-2627.sql'
    const lines = [
      '-- Sync 2024/25 scores onto 2026/27 roster student_no',
      '',
    ]
    const chunk = 100
    for (let i = 0; i < copies.length; i += chunk) {
      const part = copies.slice(i, i + chunk)
      lines.push(
        'insert into public.semester_records (student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks, source_file) values',
      )
      lines.push(
        part
          .map((r) => {
            const json = JSON.stringify(r.components ?? {}).replace(/'/g, "''")
            return `  (${sqlStr(r.student_no)}, ${r.academic_year_start}, ${r.grade}, ${sqlStr(r.semester)}, ${r.daily}, ${r.reading}, ${r.writing}, '${json}'::jsonb, ${sqlStr(r.attitude_grade)}, ${sqlStr(r.remarks)}, ${sqlStr(r.source_file)})`
          })
          .join(',\n'),
      )
      lines.push(
        'on conflict (student_no, academic_year_start, semester) do update set grade = excluded.grade, daily = excluded.daily, reading = excluded.reading, writing = excluded.writing, components = excluded.components, attitude_grade = excluded.attitude_grade, remarks = excluded.remarks, source_file = excluded.source_file, updated_at = now();',
      )
      lines.push('')
    }
    writeFileSync(path, lines.join('\n'), 'utf8')
    console.log(`\nWrote ${path}`)
    return
  }

  console.log('\nUpserting…')
  const size = 200
  for (let i = 0; i < copies.length; i += size) {
    const chunk = copies.slice(i, i + size)
    const { error } = await client!
      .from('semester_records')
      .upsert(chunk, { onConflict: 'student_no,academic_year_start,semester' })
    if (error) throw new Error(error.message)
    console.log(`  ${Math.min(i + size, copies.length)}/${copies.length}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
