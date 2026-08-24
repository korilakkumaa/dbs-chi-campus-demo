import type { GradeDeadline } from '../types'
import { GRADE_LEVELS } from './teacherWhitelist'

export function emptyGradeDeadlines(): GradeDeadline[] {
  return GRADE_LEVELS.map((grade) => ({
    grade,
    readingDue: '',
    activityTitle: '',
    activityDue: '',
    submitted: false,
  }))
}
