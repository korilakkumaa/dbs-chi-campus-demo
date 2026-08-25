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

function normalizeZhName(name: string): string {
  return name.normalize('NFKC').replace(/[\s\u3000]+/g, '').trim()
}

function normalizeEnName(name: string): string {
  return name.normalize('NFKC').toUpperCase().replace(/[^A-Z]/g, '')
}

/** Bilingual name key for rows that do not share a stored student_no. */
function identityKey(nameZh: string, nameEn: string): string | null {
  const zh = normalizeZhName(nameZh)
  const en = normalizeEnName(nameEn)
  if (zh && en) return `ze:${zh}|${en}`
  if (en.length >= 4) return `e:${en}`
  if (zh) return `z:${zh}`
  return null
}

function englishKey(nameEn: string): string | null {
  const en = normalizeEnName(nameEn)
  return en.length >= 4 ? `e:${en}` : null
}

function gradeFromClassId(classId: string): number | null {
  const match = classId.match(/^c-g?(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function isExpectedGrade(roster: StudentRow, hit: StudentRow): boolean {
  const from = gradeFromClassId(roster.class_id)
  const to = gradeFromClassId(hit.class_id)
  if (from == null || to == null) return true
  return to === from + (hit.academic_year_start - roster.academic_year_start)
}

function rowsWithKey(
  rows: StudentRow[],
  keyOf: (row: StudentRow) => string | null,
  key: string,
): StudentRow[] {
  return rows.filter((row) => keyOf(row) === key)
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

function matchStudentInYear(
  roster: StudentRow,
  yearRows: StudentRow[],
  rosterYearRows: StudentRow[],
): StudentRow | null {
  const idKey = identityKey(roster.name_zh, roster.name_en)
  if (idKey) {
    const hit = pickByExpectedGrade(
      roster,
      rowsWithKey(yearRows, (row) => identityKey(row.name_zh, row.name_en), idKey),
    )
    if (hit) return hit
  }

  const rosterEn = englishKey(roster.name_en)
  if (!rosterEn) return null
  if (
    rowsWithKey(rosterYearRows, (row) => englishKey(row.name_en), rosterEn)
      .length !== 1
  ) {
    return null
  }
  return pickByExpectedGrade(
    roster,
    rowsWithKey(yearRows, (row) => englishKey(row.name_en), rosterEn),
  )
}

function linkedStudentNos(
  roster: StudentRow,
  rowsByYear: Map<number, StudentRow[]>,
): string[] {
  const nos = new Set<string>([roster.student_no])
  const official = officialStudentNo(roster.student_no)
  const rosterYearRows = rowsByYear.get(roster.academic_year_start) ?? []
  // Only earlier years: 2025/26 may include 2024/25 history, never the reverse.
  for (const [year, rows] of rowsByYear) {
    if (year >= roster.academic_year_start || rows.length === 0) continue
    const byOfficial = rows.filter(
      (row) => officialStudentNo(row.student_no) === official,
    )
    if (byOfficial.length === 1) {
      nos.add(byOfficial[0].student_no)
      continue
    }
    const hit = matchStudentInYear(roster, rows, rosterYearRows)
    if (hit) nos.add(hit.student_no)
  }
  return [...nos]
}

function buildYearHistory(
  linkedNos: Set<string>,
  records: SemesterRow[],
  classNameByStudentYear: Map<string, string>,
  fallbackClassName: string,
  rosterYear: number,
): YearRecord[] {
  const byGrade = new Map<
    number,
    {
      first?: SemesterScores
      second?: SemesterScores
      className?: string
    }
  >()

  for (const r of records) {
    if (!linkedNos.has(r.student_no)) continue
    if (r.academic_year_start > rosterYear) continue
    const slot = byGrade.get(r.grade) ?? {}
    const scores = scoresFromSemesterRow(r)
    if (r.semester === 'first') slot.first = scores
    else slot.second = scores
    const named = classNameByStudentYear.get(
      `${r.student_no}|${r.academic_year_start}`,
    )
    if (named) slot.className = named
    byGrade.set(r.grade, slot)
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
  for (const row of allStudentRows ?? []) {
    const list = rowsByYear.get(row.academic_year_start) ?? []
    list.push(row)
    rowsByYear.set(row.academic_year_start, list)
    classNameByStudentYear.set(
      `${row.student_no}|${row.academic_year_start}`,
      classNameById.get(row.class_id) ?? row.class_id,
    )
  }

  return studentRows.map((s) => {
    const className = classNameById.get(s.class_id) ?? s.class_id
    const linkedNos = new Set(linkedStudentNos(s, rowsByYear))
    const yearHistory = buildYearHistory(
      linkedNos,
      semesterRows ?? [],
      classNameByStudentYear,
      className,
      academicYearStart,
    )
    const rosterRecords = (semesterRows ?? []).filter(
      (r) =>
        r.student_no === s.student_no &&
        r.academic_year_start === academicYearStart,
    )
    const latestRow =
      rosterRecords.find((r) => r.semester === 'second') ??
      rosterRecords.find((r) => r.semester === 'first')
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
