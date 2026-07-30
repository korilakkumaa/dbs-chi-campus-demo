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
  strengths: string[]
  notes: string
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
