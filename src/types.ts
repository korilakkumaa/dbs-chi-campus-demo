export type Role = 'admin' | 'teacher' | 'student'

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
  /** Chinese teaching stream, e.g. 7R-LWT, 8R-YCN, G7 EC-WKL (2526). */
  teachingGroup?: string
  /** Official roster: takes French instead of Chinese (removed from 母班中文名冊). */
  french?: boolean
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

/** Calendar event kinds — visual mapping on mini calendar. */
export type CalendarEventKind =
  | 'holiday'
  | 'event'
  | 'timetable'
  | 'progress'
  | 'department'
  | 'assessment'
  | 'school-day'
  | 'non-school-day'
// holiday → red day number; event → brown dot; timetable → red circle;
// progress → yellow; department → green; assessment → blue;
// school-day → 正常上課日; non-school-day → 非正常上課日

export type CalendarAudience =
  | { type: 'personal'; ownerId: string }
  | { type: 'all' }
  | {
      type: 'grades'
      grades: number[]
      /** When set, only teachers of these subjects at the listed grades see the event. */
      subjects?: import('./data/campusSubjects').CampusSubject[]
    }
  | { type: 'teachers'; teacherIds: string[] }

export interface CalendarEvent {
  id: string
  date: string
  /** Editable note / body — not the lesson identity labels. */
  title: string
  kind: CalendarEventKind
  createdBy: string
  audience: CalendarAudience
  /** Which academic year this event belongs to (e.g. 2025 → 2025/26). */
  schoolYearStart?: number
  /** Optional lesson tags from personal timetable (class / subject / time). */
  lesson?: {
    group: string
    subject: string
    start: string
    end: string
    room?: string
  }
}
