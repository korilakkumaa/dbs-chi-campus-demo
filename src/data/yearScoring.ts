import type { SemesterScores, Student, YearRecord } from '../types'

/** Max contribution (%) of each component within a semester. */
export const SUBJECT_MAX = {
  daily: 20,
  reading: 40,
  writing: 45,
} as const

export const SEMESTER_MAX =
  SUBJECT_MAX.daily + SUBJECT_MAX.reading + SUBJECT_MAX.writing

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

export function paperKey(semester: SemesterKey, subject: SubjectKey): PaperKey {
  return `${semester}-${subject}`
}

/** Convert raw 0–100 mark into weighted contribution points. */
export function subjectEarned(rawScore: number, subject: SubjectKey): number {
  const clamped = Math.min(100, Math.max(0, rawScore))
  return Math.round((clamped / 100) * SUBJECT_MAX[subject])
}

export function semesterPoints(scores: SemesterScores): number {
  return (
    subjectEarned(scores.daily, 'daily') +
    subjectEarned(scores.reading, 'reading') +
    subjectEarned(scores.writing, 'writing')
  )
}

export function yearPoints(record: YearRecord): number {
  return Math.round(
    semesterPoints(record.first) * YEAR_WEIGHTS.first +
      semesterPoints(record.second) * YEAR_WEIGHTS.second,
  )
}

export function semesterTotal(scores: SemesterScores): number {
  return semesterPoints(scores)
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
      push(sameYearTotal, String(record.grade), yearPoints(record))
      for (const semester of ['first', 'second'] as const) {
        push(
          sameYearSemester,
          `${record.grade}-${semester}`,
          semesterPoints(record[semester]),
        )
        for (const subject of ['daily', 'reading', 'writing'] as const) {
          const earned = subjectEarned(record[semester][subject], subject)
          push(
            sameYearSubject,
            `${record.grade}-${semester}-${subject}`,
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
