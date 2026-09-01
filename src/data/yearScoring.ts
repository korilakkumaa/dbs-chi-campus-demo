import type { SemesterScores, Student, YearRecord } from '../types'

export type SubjectMaxes = {
  daily: number
  reading: number
  writing: number
}

/** G7–G9：CA 20%、閱讀 40%、寫作 40%（學期滿分 100）。 */
export const JUNIOR_SUBJECT_MAX: SubjectMaxes = {
  daily: 20,
  reading: 40,
  writing: 40,
}

/** 2024/25 初中（G7–G9）：CA 30%、閱讀 35%、寫作 35%。 */
export const JUNIOR_2425_ACADEMIC_YEAR_START = 2024

export const JUNIOR_2425_SUBJECT_MAX: SubjectMaxes = {
  daily: 30,
  reading: 35,
  writing: 35,
}

/** G10–G12：CA 15%、閱讀 40%、寫作 45%（學期滿分 100）。 */
export const SENIOR_SUBJECT_MAX: SubjectMaxes = {
  daily: 15,
  reading: 40,
  writing: 45,
}

/** @deprecated Use {@link subjectMaxForGrade}. */
export const SUBJECT_MAX = SENIOR_SUBJECT_MAX

/** @deprecated Use {@link semesterMaxForGrade}. */
export const SEMESTER_MAX =
  SENIOR_SUBJECT_MAX.daily +
  SENIOR_SUBJECT_MAX.reading +
  SENIOR_SUBJECT_MAX.writing

/** Year composition: first 35%, second 65%. */
export const YEAR_WEIGHTS = {
  first: 0.35,
  second: 0.65,
} as const

export type SemesterKey = 'first' | 'second'
export type SubjectKey = 'daily' | 'reading' | 'writing'
export type PaperKey = `${SemesterKey}-${SubjectKey}`

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  daily: 'CA',
  reading: '閱讀',
  writing: '寫作',
}

export const SEMESTER_LABELS: Record<SemesterKey, string> = {
  first: '上學期',
  second: '下學期',
}

export const PAPER_ROWS: {
  semester: SemesterKey
  subject: SubjectKey
  label: string
}[] = (
  [
    ['first', 'daily'],
    ['first', 'reading'],
    ['first', 'writing'],
    ['second', 'daily'],
    ['second', 'reading'],
    ['second', 'writing'],
  ] as const
).map(([semester, subject]) => ({
  semester,
  subject,
  label: SUBJECT_LABELS[subject],
}))

export function isSeniorGrade(grade: number): boolean {
  return grade >= 10
}

export function usesJunior2425Weights(
  grade: number,
  academicYearStart?: number,
): boolean {
  return (
    academicYearStart === JUNIOR_2425_ACADEMIC_YEAR_START && !isSeniorGrade(grade)
  )
}

export function subjectMaxForGrade(
  grade: number,
  academicYearStart?: number,
): SubjectMaxes {
  if (usesJunior2425Weights(grade, academicYearStart)) {
    return JUNIOR_2425_SUBJECT_MAX
  }
  return isSeniorGrade(grade) ? SENIOR_SUBJECT_MAX : JUNIOR_SUBJECT_MAX
}

export function semesterMaxForGrade(
  grade: number,
  academicYearStart?: number,
): number {
  const m = subjectMaxForGrade(grade, academicYearStart)
  return m.daily + m.reading + m.writing
}

export function scoreWeightsLabel(
  grade: number,
  academicYearStart?: number,
): string {
  const m = subjectMaxForGrade(grade, academicYearStart)
  return `CA ${m.daily}% · 閱讀 ${m.reading}% · 寫作 ${m.writing}%`
}

export function scoringBandForSemester(
  record: YearRecord,
  semester: SemesterKey,
): { grade: number; academicYearStart?: number } {
  const grade =
    (semester === 'first' ? record.firstScoreGrade : record.secondScoreGrade) ??
    record.grade
  const academicYearStart =
    semester === 'first'
      ? record.firstAcademicYearStart
      : record.secondAcademicYearStart
  return { grade, academicYearStart }
}

export function paperKey(semester: SemesterKey, subject: SubjectKey): PaperKey {
  return `${semester}-${subject}`
}

/** Convert raw 0–100 mark into weighted contribution points for a grade band. */
export function subjectEarned(
  rawScore: number,
  subject: SubjectKey,
  grade: number,
  academicYearStart?: number,
): number {
  const clamped = Math.min(100, Math.max(0, rawScore))
  const max = subjectMaxForGrade(grade, academicYearStart)[subject]
  return Math.round((clamped / 100) * max)
}

export function semesterPoints(
  scores: SemesterScores,
  grade: number,
  academicYearStart?: number,
): number {
  return (
    subjectEarned(scores.daily, 'daily', grade, academicYearStart) +
    subjectEarned(scores.reading, 'reading', grade, academicYearStart) +
    subjectEarned(scores.writing, 'writing', grade, academicYearStart)
  )
}

export function recordHasSemester(
  record: YearRecord,
  semester: SemesterKey,
): boolean {
  if (semester === 'first') return record.hasFirst !== false
  return record.hasSecond !== false
}

export function yearPoints(record: YearRecord): number {
  const hasFirst = recordHasSemester(record, 'first')
  const hasSecond = recordHasSemester(record, 'second')
  const firstBand = scoringBandForSemester(record, 'first')
  const secondBand = scoringBandForSemester(record, 'second')
  const first = hasFirst
    ? semesterPoints(
        record.first,
        firstBand.grade,
        firstBand.academicYearStart,
      )
    : null
  const second = hasSecond
    ? semesterPoints(
        record.second,
        secondBand.grade,
        secondBand.academicYearStart,
      )
    : null
  if (first != null && second != null) {
    return Math.round(first * YEAR_WEIGHTS.first + second * YEAR_WEIGHTS.second)
  }
  if (first != null) return first
  if (second != null) return second
  return 0
}

export function semesterTotal(
  scores: SemesterScores,
  grade: number,
  academicYearStart?: number,
): number {
  return semesterPoints(scores, grade, academicYearStart)
}

/** CA + 閱讀 + 寫作加權分（與 Excel 學期總分一致）。 */
export function semesterWeightedTotal(
  s: Pick<Student, 'progress' | 'readingScore' | 'correctRate'>,
): number {
  return Math.round((s.progress + s.readingScore + s.correctRate) * 10) / 10
}

export function yearTotal(record: YearRecord): number {
  return yearPoints(record)
}

export function subjectScore(
  record: YearRecord,
  semester: SemesterKey,
  subject: SubjectKey,
): number {
  return record[semester][subject]
}

/** Higher score → higher percentile (1–99). */
export function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 50
  let below = 0
  let equal = 0
  for (const v of population) {
    if (v < value) below += 1
    else if (v === value) equal += 1
  }
  return Math.min(
    99,
    Math.max(1, Math.round(((below + equal * 0.5) / population.length) * 100)),
  )
}

/** 1-based rank among population (1 = highest). Ties share the best place. */
export function descendingRank(value: number, population: number[]): number {
  if (population.length === 0) return 1
  let better = 0
  for (const v of population) {
    if (v > value) better += 1
  }
  return better + 1
}

export type Quartile = 'q1' | 'q2' | 'q3' | 'q4'

export function quartileFromPercentile(percentile: number): Quartile {
  if (percentile >= 75) return 'q1'
  if (percentile >= 50) return 'q2'
  if (percentile >= 25) return 'q3'
  return 'q4'
}

export function quartileLabel(q: Quartile): string {
  if (q === 'q1') return '首 25%'
  if (q === 'q2') return '25%–50%'
  if (q === 'q3') return '50%–75%'
  return '末 25%'
}

/** Build score pools for same-year and same-paper cross-year percentiles. */
export function buildScorePools(students: Student[]) {
  const sameYearSubject = new Map<string, number[]>()
  const sameYearSemester = new Map<string, number[]>()
  const sameYearTotal = new Map<string, number[]>()
  const crossPaper = new Map<PaperKey, number[]>()

  const push = (map: Map<string, number[]>, key: string, value: number) => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
  }

  for (const student of students) {
    for (const record of student.yearHistory) {
      const { grade } = record
      push(sameYearTotal, String(grade), yearPoints(record))
      for (const semester of ['first', 'second'] as const) {
        if (!recordHasSemester(record, semester)) continue
        const band = scoringBandForSemester(record, semester)
        push(
          sameYearSemester,
          `${grade}-${semester}`,
          semesterPoints(
            record[semester],
            band.grade,
            band.academicYearStart,
          ),
        )
        for (const subject of ['daily', 'reading', 'writing'] as const) {
          const earned = subjectEarned(
            record[semester][subject],
            subject,
            band.grade,
            band.academicYearStart,
          )
          push(
            sameYearSubject,
            `${grade}-${semester}-${subject}`,
            earned,
          )
          const crossList = crossPaper.get(paperKey(semester, subject))
          if (crossList) crossList.push(earned)
          else crossPaper.set(paperKey(semester, subject), [earned])
        }
      }
    }
  }

  return { sameYearSubject, sameYearSemester, sameYearTotal, crossPaper }
}

export function lookupPercentile(
  pools: ReturnType<typeof buildScorePools>,
  grade: number,
  semester: SemesterKey,
  subject: SubjectKey,
  earned: number,
): { sameYear: number; crossYear: number } {
  const sameYear =
    pools.sameYearSubject.get(`${grade}-${semester}-${subject}`) ?? []
  const crossYear = pools.crossPaper.get(paperKey(semester, subject)) ?? []
  return {
    sameYear: percentileRank(earned, sameYear),
    crossYear: percentileRank(earned, crossYear),
  }
}
