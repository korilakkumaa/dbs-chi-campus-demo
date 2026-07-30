export type Role = 'admin' | 'teacher'

export interface User {
  id: string
  username: string
  password: string
  name: string
  role: Role
  classIds: string[]
}

export interface SchoolClass {
  id: string
  name: string
  grade: string
  teacherId: string | null
}

export interface Student {
  id: string
  name: string
  classId: string
  classNumber: number
  progress: number
  readingScore: number
  correctRate: number
  recentScores: { label: string; score: number }[]
  /** Academic history from G7 through current grade. */
  yearHistory: YearRecord[]
  strengths: string[]
  notes: string
}

/** One school year’s summary for longitudinal tracking. */
export interface SemesterScores {
  daily: number
  reading: number
  writing: number
}

export interface YearRecord {
  grade: number
  className: string
  first: SemesterScores
  second: SemesterScores
}

/** Admin-assigned deadlines, unified per grade (7–12). */
export interface GradeDeadline {
  grade: number
  readingDue: string
  activityTitle: string
  activityDue: string
  /** Confirmed by admin via submit tick; only then shown to teachers. */
  submitted: boolean
}
