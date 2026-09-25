import { calendarGradeAudienceMatchesUser } from './campusSubjects'
import { teachersForYear } from './staffUsers'
import type { CalendarAudience, SchoolClass } from '../types'

/**
 * Teacher user ids who should be notified for a shared calendar audience.
 * Mirrors visibility rules used by the calendar (all / teachers / grades).
 */
export function resolveCalendarNotifyRecipients(
  audience: CalendarAudience,
  schoolYearStart: number,
  allClasses: SchoolClass[],
): string[] {
  if (audience.type === 'personal') return []

  const yearTeachers = teachersForYear(schoolYearStart)

  if (audience.type === 'all') {
    return yearTeachers.map((t) => t.id)
  }

  if (audience.type === 'teachers') {
    return [...new Set(audience.teacherIds.filter(Boolean))]
  }

  if (audience.type === 'grades') {
    return yearTeachers
      .filter((teacher) => {
        const accessibleClasses = allClasses.filter((cls) =>
          teacher.classIds.includes(cls.id),
        )
        return calendarGradeAudienceMatchesUser(audience, teacher, {
          accessibleClasses,
          allClasses,
          scoresAcademicYearStart: schoolYearStart,
        })
      })
      .map((t) => t.id)
  }

  return []
}

/** Human-readable date line for notification body. */
export function formatCalendarNotifyDates(dates: string[]): string {
  const unique = [...new Set(dates.filter(Boolean))].sort()
  if (unique.length === 0) return ''
  if (unique.length === 1) return `日期：${unique[0]}`
  return `日期：${unique[0]}～${unique[unique.length - 1]}（共 ${unique.length} 日）`
}
