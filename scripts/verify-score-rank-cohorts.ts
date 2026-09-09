/**
 * Guard: grade ranks must not mix different academic-year cohorts.
 *
 * 1) Always: in-memory regression check on buildScorePools keys.
 * 2) With Supabase env: live pools must stay within one year's headcount
 *    for each (academic_year_start, grade), not the sum of several years.
 *
 *   npm run verify:score-rank-cohorts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { officialStudentNo } from '../src/data/campusScoresYear'
import {
  buildScorePools,
  scorePoolTotalKey,
} from '../src/data/yearScoring'
import type { Student, YearRecord } from '../src/types'

config({ path: '.env.local' })
config()

const ROSTER_YEAR = Number(process.env.VERIFY_ROSTER_YEAR ?? 2026)
const PAGE = 1000
/** Allow a few extras (remaps / odd grade tags); fail if pool looks like 2+ years merged. */
const MAX_OVER_DB_UNIQUE = 15

function emptyScores() {
  return { daily: 0, reading: 0, writing: 0 }
}

function yearRecord(
  grade: number,
  academicYearStart: number,
  opts?: Partial<YearRecord>,
): YearRecord {
  return {
    grade,
    className: `G${grade}`,
    first: emptyScores(),
    second: emptyScores(),
    hasFirst: true,
    hasSecond: true,
    firstAcademicYearStart: academicYearStart,
    secondAcademicYearStart: academicYearStart,
    firstScoreGrade: grade,
    secondScoreGrade: grade,
    ...opts,
  }
}

function assertPoolKeysDoNotMixCohorts(): void {
  const students: Student[] = [
    {
      id: 'a',
      name: 'A',
      classId: 'c-8a',
      classNumber: 1,
      progress: 0,
      readingScore: 0,
      correctRate: 0,
      recentScores: [],
      notes: '',
      // 2026 Form 2: prior year shows as 中一, earned in 2025
      yearHistory: [yearRecord(7, 2025)],
    },
    {
      id: 'b',
      name: 'B',
      classId: 'c-9a',
      classNumber: 1,
      progress: 0,
      readingScore: 0,
      correctRate: 0,
      recentScores: [],
      notes: '',
      // 2026 Form 3: 2024 G7 also displays as 中一
      yearHistory: [yearRecord(7, 2024)],
    },
  ]

  const pools = buildScorePools(students)
  const mixed = pools.sameYearTotal.get(String(7)) ?? []
  const y2025 = pools.sameYearTotal.get(scorePoolTotalKey(7, 2025)) ?? []
  const y2024 = pools.sameYearTotal.get(scorePoolTotalKey(7, 2024)) ?? []

  if (mixed.length >= 2) {
    throw new Error(
      `REGRESSION: sameYearTotal still keys by grade only (got ${mixed.length} under "7"). ` +
        `Ranks would mix 2024+2025 cohorts again.`,
    )
  }
  if (y2025.length !== 1 || y2024.length !== 1) {
    throw new Error(
      `Expected separate cohort pools 2025|7 and 2024|7 (sizes 1,1); ` +
        `got ${y2025.length} and ${y2024.length}.`,
    )
  }
  console.log('OK: in-memory pools keep 2024 G7 and 2025 G7 in separate keys.')
}

async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

type StudentRow = {
  student_no: string
  class_id: string
  academic_year_start: number
}

type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: string
  source_file: string | null
}

function gradeFromClassId(classId: string): number | null {
  const match = classId.match(/^c-g?(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function displayGradeForRecord(
  record: SemesterRow,
  rosterYear: number,
  currentGrade: number | null,
): number {
  if (currentGrade != null && record.academic_year_start < rosterYear) {
    const mapped = currentGrade - (rosterYear - record.academic_year_start)
    if (mapped >= 7 && mapped <= 12) return mapped
  }
  return record.grade
}

async function assertLivePoolsMatchDbCohorts(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log(
      'Skip live check: set VITE_SUPABASE_URL and a Supabase key in .env.local',
    )
    return
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const students = await fetchAll<StudentRow>((from, to) =>
    client
      .from('students')
      .select('student_no, class_id, academic_year_start')
      .lte('academic_year_start', ROSTER_YEAR)
      .range(from, to),
  )
  const records = await fetchAll<SemesterRow>((from, to) =>
    client
      .from('semester_records')
      .select('student_no, academic_year_start, grade, semester, source_file')
      .lte('academic_year_start', ROSTER_YEAR)
      .range(from, to),
  )

  const dbUnique = new Map<string, Set<string>>()
  for (const r of records) {
    if (r.source_file?.startsWith('sync2627:')) continue
    const key = `${r.academic_year_start}|${r.grade}`
    const set = dbUnique.get(key) ?? new Set()
    set.add(officialStudentNo(r.student_no))
    dbUnique.set(key, set)
  }

  const rowsByYear = new Map<number, StudentRow[]>()
  for (const row of students) {
    const list = rowsByYear.get(row.academic_year_start) ?? []
    list.push(row)
    rowsByYear.set(row.academic_year_start, list)
  }
  const roster = rowsByYear.get(ROSTER_YEAR) ?? []

  /** displayGrade|academicYear → unique STIDs in app-style yearHistory */
  const appPools = new Map<string, Set<string>>()

  for (const s of roster) {
    const official = officialStudentNo(s.student_no)
    const currentGrade = gradeFromClassId(s.class_id)
    const nos = new Set<string>([s.student_no])
    for (const year of [...rowsByYear.keys()]
      .filter((y) => y < ROSTER_YEAR)
      .sort((a, b) => b - a)) {
      const hits = (rowsByYear.get(year) ?? []).filter(
        (row) => officialStudentNo(row.student_no) === official,
      )
      if (hits.length === 1) nos.add(hits[0].student_no)
    }

    const hist = records.filter((r) => {
      if (r.source_file?.startsWith('sync2627:')) return false
      if (r.academic_year_start > ROSTER_YEAR) return false
      if (nos.has(r.student_no)) return true
      return (
        r.academic_year_start < ROSTER_YEAR &&
        officialStudentNo(r.student_no) === official
      )
    })

    const byDisplay = new Map<number, { years: Set<number>; grades: Set<number> }>()
    for (const r of hist) {
      const dg = displayGradeForRecord(r, ROSTER_YEAR, currentGrade)
      const slot = byDisplay.get(dg) ?? {
        years: new Set<number>(),
        grades: new Set<number>(),
      }
      slot.years.add(r.academic_year_start)
      slot.grades.add(r.grade)
      byDisplay.set(dg, slot)
    }

    for (const [dg, slot] of byDisplay) {
      // Same rule as recordCohortAcademicYear: prefer a single earned year.
      const cohortYear = [...slot.years].sort((a, b) => b - a)[0]
      if (cohortYear == null) continue
      const key = scorePoolTotalKey(dg, cohortYear)
      const set = appPools.get(key) ?? new Set()
      set.add(official)
      appPools.set(key, set)
    }
  }

  let failed = false
  console.log(`Live check vs roster ${ROSTER_YEAR} (${roster.length} students):`)
  for (const [key, set] of [...appPools.entries()].sort()) {
    const [yearStr, gradeStr] = key.split('|')
    const year = Number(yearStr)
    const grade = Number(gradeStr)
    const dbCount = dbUnique.get(`${year}|${grade}`)?.size ?? 0
    // Also allow match against any DB grade that year if display remap used actual grade
    let maxDbSameYear = dbCount
    for (const [dbKey, stids] of dbUnique) {
      if (dbKey.startsWith(`${year}|`)) {
        maxDbSameYear = Math.max(maxDbSameYear, stids.size)
      }
    }
    const poolSize = set.size
    const ok = poolSize <= maxDbSameYear + MAX_OVER_DB_UNIQUE
    const mark = ok ? 'OK' : 'FAIL'
    console.log(
      `  [${mark}] pool ${key}: ${poolSize}  (DB ${year}|G* max unique ${maxDbSameYear}, exact G${grade} ${dbCount})`,
    )
    if (!ok) {
      failed = true
      console.error(
        `    Pool looks larger than one cohort — likely mixing academic years again.`,
      )
    }
  }

  if (failed) {
    throw new Error('Live cohort pool check failed.')
  }
  console.log('OK: live rank pools stay within single-year cohort sizes.')
}

async function main() {
  assertPoolKeysDoNotMixCohorts()
  await assertLivePoolsMatchDbCohorts()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
