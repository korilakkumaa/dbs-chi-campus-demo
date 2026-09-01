import type { SupabaseClient } from '@supabase/supabase-js'
import type { SemesterScores, Student, YearRecord } from '../types'
import {
  officialStudentNo,
  SCORES_IMPORTED_ACADEMIC_YEARS,
} from './campusScoresYear'
import { subjectMaxForGrade } from './yearScoring'
import { supabase } from '../lib/supabase'

type StudentRow = {
  student_no: string
  class_id: string
  class_number: number
  name_zh: string
  name_en: string
  teaching_group: string
  academic_year_start: number
  house?: string | null
  french?: boolean | null
  roster_remarks?: string | null
}

type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: 'first' | 'second'
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string> | null
  attitude_grade: string | null
  remarks: string | null
}

/** PostgREST defaults to max 1000 rows — page until exhausted. */
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[] | null; error: string | null }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildPage(from, to)
    if (error) return { data: null, error: error.message }
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { data: all, error: null }
}

function roundScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)))
}

/** Excel weighted contribution (CA≤20, reading≤40, writing≤45). */
function roundWeighted(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.max(0, n) * 10) / 10
}

function recentFromComponents(
  components: Record<string, number | string> | null | undefined,
): { label: string; score: number }[] {
  if (!components) return []
  const wanted: { match: (k: string) => boolean; label: string }[] = [
    { match: (k) => k.includes('測驗') || k.includes('統測'), label: '測驗' },
    { match: (k) => k.includes('卷一'), label: '卷一' },
    { match: (k) => k.includes('卷二'), label: '卷二' },
    {
      match: (k) => k.includes('作文（一）') || k.includes('作文 (一)'),
      label: '作文一',
    },
  ]
  const out: { label: string; score: number }[] = []
  for (const w of wanted) {
    for (const [k, v] of Object.entries(components)) {
      if (!w.match(k.toLowerCase()) && !w.match(k)) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n)) continue
      // Scale sub-max marks roughly toward 0–100 for display.
      let score = n
      if (k.includes('測驗') && n <= 45) score = (n / 45) * 100
      out.push({ label: w.label, score: roundScore(score) })
      break
    }
  }
  return out.slice(0, 4)
}

function componentNumber(
  components: Record<string, number | string> | null | undefined,
  keys: string[],
): number | null {
  if (!components) return null
  const entries = Object.entries(components)
  for (const want of keys) {
    const wantNorm = want.toLowerCase()
    for (const [k, v] of entries) {
      if (k.toLowerCase() !== wantNorm) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

/**
 * Build 0–100 raw scores for yearScoring.
 * Prefer Excel summary fields (weighted contributions) and convert to raw;
 * fall back to daily/reading/writing columns.
 */
function scoresFromSemesterRow(r: SemesterRow): SemesterScores {
  const weighted = weightedScoresFromSemesterRow(r)
  const max = subjectMaxForGrade(r.grade)
  return {
    daily: roundScore(max.daily > 0 ? (weighted.daily / max.daily) * 100 : 0),
    reading: roundScore(
      max.reading > 0 ? (weighted.reading / max.reading) * 100 : 0,
    ),
    writing: roundScore(
      max.writing > 0 ? (weighted.writing / max.writing) * 100 : 0,
    ),
  }
}

/**
 * Excel semester weighted contributions (grade band: junior 20/40/40, senior 15/40/45).
 * Prefer summary fields; reading/writing columns are already contributions.
 */
function weightedScoresFromSemesterRow(r: SemesterRow): SemesterScores {
  const ca = componentNumber(r.components, [
    'class assignments score',
    'c.a%',
    'ca分 %',
    'ca分%',
  ])
  const readingContrib = componentNumber(r.components, [
    'reading score',
    '卷一 %',
    '卷一%',
  ])
  const writingContrib = componentNumber(r.components, [
    'writing score',
    '卷二 %',
    '卷二%',
  ])

  if (ca != null && readingContrib != null && writingContrib != null) {
    return {
      daily: roundWeighted(ca),
      reading: roundWeighted(readingContrib),
      writing: roundWeighted(writingContrib),
    }
  }

  const colDaily = Number(r.daily)
  const colReading = Number(r.reading)
  const colWriting = Number(r.writing)
  const max = subjectMaxForGrade(r.grade)
  return {
    daily: roundWeighted(
      ca ?? (colDaily > max.daily ? (colDaily / 100) * max.daily : colDaily),
    ),
    reading: roundWeighted(readingContrib ?? colReading),
    writing: roundWeighted(writingContrib ?? colWriting),
  }
}

const EMPTY_SCORES: SemesterScores = { daily: 0, reading: 0, writing: 0 }

function gradeFromClassId(classId: string): number | null {
  const match = classId.match(/^c-g?(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/** e.g. c-8m + 1 year back → c-7m (2627 G8 ↔ 2526 G7). */
function priorClassId(classId: string, yearOffset: number): string | null {
  const match = classId.match(/^(c-)(\d+)(.*)$/i)
  if (!match || yearOffset <= 0) return null
  const grade = Number(match[2]) - yearOffset
  if (grade < 7 || grade > 12) return null
  return `${match[1]}${grade}${match[3]}`
}

function isExpectedGrade(roster: StudentRow, hit: StudentRow): boolean {
  const from = gradeFromClassId(roster.class_id)
  const to = gradeFromClassId(hit.class_id)
  if (from == null || to == null) return true
  return to === from + (hit.academic_year_start - roster.academic_year_start)
}

function pickByExpectedGrade(
  roster: StudentRow,
  hits: StudentRow[],
): StudentRow | null {
  const expected = hits.filter((hit) => isExpectedGrade(roster, hit))
  if (expected.length === 1) return expected[0]
  if (expected.length > 1) {
    const form = expected.filter((hit) => !/r_/i.test(hit.class_id))
    if (form.length === 1) return form[0]
  }
  return null
}

function matchByOfficialStid(
  official: string,
  yearRows: StudentRow[],
): StudentRow | null {
  const hits = yearRows.filter(
    (row) => officialStudentNo(row.student_no) === official,
  )
  return hits.length === 1 ? hits[0] : null
}

/** Fallback when STID does not match: same class + class number (grade-safe). */
function matchByClassAndNumber(
  anchor: StudentRow,
  yearRows: StudentRow[],
): StudentRow | null {
  if (anchor.class_number <= 0) return null
  const hits = yearRows.filter(
    (row) =>
      row.class_id === anchor.class_id &&
      row.class_number === anchor.class_number,
  )
  return pickByExpectedGrade(anchor, hits)
}

/**
 * Cross-year fallback: 2627 G8#12 ↔ 2526 G7#12 (same class letter, prior grade).
 */
function matchByPromotedClass(
  anchor: StudentRow,
  priorYear: number,
  yearRows: StudentRow[],
): StudentRow | null {
  const offset = anchor.academic_year_start - priorYear
  if (offset <= 0 || anchor.class_number <= 0) return null
  const priorClass = priorClassId(anchor.class_id, offset)
  if (!priorClass) return null
  const hits = yearRows.filter(
    (row) =>
      row.class_id === priorClass &&
      row.class_number === anchor.class_number,
  )
  if (hits.length === 1) return hits[0]
  return pickByExpectedGrade(anchor, hits)
}

/**
 * Link roster student_no across prior academic years.
 * Walk newest→oldest: STID first, then class+class_number on the anchor
 * from the year just matched (not the current-year roster).
 */
function linkedStudentNos(
  roster: StudentRow,
  rowsByYear: Map<number, StudentRow[]>,
): string[] {
  const nos = new Set<string>([roster.student_no])
  const official = officialStudentNo(roster.student_no)
  let anchor: StudentRow = roster

  const priorYears = [...rowsByYear.keys()]
    .filter((year) => year < roster.academic_year_start)
    .sort((a, b) => b - a)

  for (const year of priorYears) {
    const rows = rowsByYear.get(year) ?? []
    if (rows.length === 0) continue

    const byStid = matchByOfficialStid(official, rows)
    let hit =
      byStid ??
      matchByPromotedClass(anchor, year, rows) ??
      matchByPromotedClass(roster, year, rows) ??
      matchByClassAndNumber(anchor, rows) ??
      matchByClassAndNumber(roster, rows)

    if (!hit) continue
    nos.add(hit.student_no)
    anchor = hit
  }

  return [...nos]
}

function pickLatestSemesterRow(rows: SemesterRow[]): SemesterRow | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => {
    if (a.academic_year_start !== b.academic_year_start) {
      return b.academic_year_start - a.academic_year_start
    }
    if (a.semester === b.semester) return 0
    return a.semester === 'second' ? -1 : 1
  })[0]
}

/**
 * Map prior-year score rows onto the grade band shown on the current roster.
 * 2627 G8 → 2526 rows display as G7; 2627 G9 → 2425 rows as G7, etc.
 */
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

function historyRecordsForStudent(
  roster: StudentRow,
  linkedNos: Set<string>,
  records: SemesterRow[],
  rosterYear: number,
): SemesterRow[] {
  const official = officialStudentNo(roster.student_no)
  return records.filter((r) => {
    if (r.academic_year_start > rosterYear) return false
    if (linkedNos.has(r.student_no)) return true
    if (r.student_no === roster.student_no) return true
    return (
      r.academic_year_start < rosterYear &&
      officialStudentNo(r.student_no) === official
    )
  })
}

function buildYearHistory(
  roster: StudentRow,
  linkedNos: Set<string>,
  records: SemesterRow[],
  classNameByStudentYear: Map<string, string>,
  classNameByOfficialYear: Map<string, string>,
  fallbackClassName: string,
  rosterYear: number,
): YearRecord[] {
  const currentGrade = gradeFromClassId(roster.class_id)
  const historyRecords = historyRecordsForStudent(
    roster,
    linkedNos,
    records,
    rosterYear,
  )
  const byGrade = new Map<
    number,
    {
      first?: SemesterScores
      second?: SemesterScores
      className?: string
    }
  >()

  for (const r of historyRecords) {
    const displayGrade = displayGradeForRecord(r, rosterYear, currentGrade)
    const slot = byGrade.get(displayGrade) ?? {}
    const scores = scoresFromSemesterRow(r)
    if (r.semester === 'first') slot.first = scores
    else slot.second = scores
    const official = officialStudentNo(r.student_no)
    const named =
      classNameByStudentYear.get(`${r.student_no}|${r.academic_year_start}`) ??
      classNameByOfficialYear.get(`${official}|${r.academic_year_start}`)
    if (named) slot.className = named
    byGrade.set(displayGrade, slot)
  }

  return [...byGrade.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([grade, slot]) => ({
      grade,
      className: slot.className ?? fallbackClassName,
      first: slot.first ?? EMPTY_SCORES,
      second: slot.second ?? EMPTY_SCORES,
      hasFirst: slot.first != null,
      hasSecond: slot.second != null,
    }))
}

function studentFetchYears(academicYearStart: number): number[] {
  const imported = [...SCORES_IMPORTED_ACADEMIC_YEARS]
  if (!imported.some((year) => year === academicYearStart)) {
    return [academicYearStart]
  }
  return imported.filter((year) => year <= academicYearStart)
}

export async function fetchCampusStudentsFromSupabase(
  academicYearStart: number,
): Promise<Student[] | null> {
  if (!supabase) return null
  const client: SupabaseClient = supabase
  const years = studentFetchYears(academicYearStart)

  const { data: allStudentRows, error: studentError } =
    await fetchAllRows<StudentRow>((from, to) =>
      client
        .from('students')
        .select(
          'student_no, class_id, class_number, name_zh, name_en, teaching_group, academic_year_start, house, french, roster_remarks',
        )
        .in('academic_year_start', years)
        .order('class_id')
        .order('class_number')
        .range(from, to),
    )

  if (studentError) {
    console.error('Supabase students:', studentError)
    return null
  }

  const studentRows = (allStudentRows ?? []).filter(
    (s) => s.academic_year_start === academicYearStart,
  )
  if (!studentRows.length) return []

  const { data: classRows } = await client.from('classes').select('id, name')
  const classNameById = new Map(
    (classRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  )

  const { data: semesterRows, error: semesterError } =
    await fetchAllRows<SemesterRow>((from, to) =>
      client
        .from('semester_records')
        .select(
          'student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks',
        )
        .in('academic_year_start', years)
        .order('student_no')
        .order('grade')
        .order('semester')
        .range(from, to),
    )

  if (semesterError) {
    console.error('Supabase semester_records:', semesterError)
    return null
  }

  const rowsByYear = new Map<number, StudentRow[]>()
  const classNameByStudentYear = new Map<string, string>()
  const classNameByOfficialYear = new Map<string, string>()
  for (const row of allStudentRows ?? []) {
    const list = rowsByYear.get(row.academic_year_start) ?? []
    list.push(row)
    rowsByYear.set(row.academic_year_start, list)
    const rowClassName = classNameById.get(row.class_id) ?? row.class_id
    classNameByStudentYear.set(
      `${row.student_no}|${row.academic_year_start}`,
      rowClassName,
    )
    classNameByOfficialYear.set(
      `${officialStudentNo(row.student_no)}|${row.academic_year_start}`,
      rowClassName,
    )
  }

  return studentRows.map((s) => {
    const className = classNameById.get(s.class_id) ?? s.class_id
    const linkedNos = new Set(linkedStudentNos(s, rowsByYear))
    const historyRecords = historyRecordsForStudent(
      s,
      linkedNos,
      semesterRows ?? [],
      academicYearStart,
    )
    const yearHistory = buildYearHistory(
      s,
      linkedNos,
      semesterRows ?? [],
      classNameByStudentYear,
      classNameByOfficialYear,
      className,
      academicYearStart,
    )
    const rosterRecords = historyRecords.filter(
      (r) => r.academic_year_start === academicYearStart,
    )
    const priorLinkedRecords =
      rosterRecords.length === 0
        ? historyRecords.filter((r) => r.academic_year_start < academicYearStart)
        : []
    const latestRow =
      pickLatestSemesterRow(rosterRecords) ??
      pickLatestSemesterRow(priorLinkedRecords)
    const latestScores = latestRow
      ? weightedScoresFromSemesterRow(latestRow)
      : { daily: 0, reading: 0, writing: 0 }
    const readingScore = latestScores.reading
    const writingScore = latestScores.writing
    const dailyScore = latestScores.daily

    const noteParts = [
      latestRow?.remarks?.trim(),
      s.roster_remarks?.trim(),
      s.house ? `House: ${s.house}` : '',
    ].filter(Boolean)

    return {
      id: s.student_no,
      name: s.name_zh,
      classId: s.class_id,
      classNumber: s.class_number,
      teachingGroup: s.teaching_group || undefined,
      french: Boolean(s.french),
      progress: dailyScore,
      readingScore,
      correctRate: writingScore,
      recentScores: recentFromComponents(latestRow?.components ?? null),
      yearHistory,
      notes: noteParts.join(' · '),
    } satisfies Student
  })
}

export async function fetchCampusClassesFromSupabase(): Promise<
  { id: string; name: string; grade: string; teacherId: string | null }[] | null
> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, teacher_id')
    .order('grade')
    .order('name')

  if (error) {
    console.error('Supabase classes:', error.message)
    return null
  }

  return (data ?? []).map(
    (c: {
      id: string
      name: string
      grade: number
      teacher_id: string | null
    }) => ({
      id: c.id,
      name: c.name,
      grade: `G${c.grade}`,
      teacherId: c.teacher_id,
    }),
  )
}
