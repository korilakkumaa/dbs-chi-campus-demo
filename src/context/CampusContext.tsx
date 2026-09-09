import { useMemo, type ReactNode } from 'react'
import {
  CalendarCampusProvider,
  useCalendarCampus,
  type CalendarCampusContextValue,
} from './CalendarCampusContext'
import {
  RosterProvider,
  useRoster,
  type RosterContextValue,
} from './RosterContext'
import {
  ScoresCampusProvider,
  useScoresCampus,
  type ScoresCampusContextValue,
} from './ScoresCampusContext'

/** Legacy combined shape — same fields as the former monolithic CampusContext. */
export type CampusContextValue = Omit<
  RosterContextValue,
  'teachingAccessibleClasses' | 'teachingYearStart'
> &
  ScoresCampusContextValue &
  CalendarCampusContextValue

/**
 * Nest order: Scores (year) → Roster (reads year; re-provides derived scores)
 * → Calendar (reads roster teaching scope).
 */
export function CampusProvider({ children }: { children: ReactNode }) {
  return (
    <ScoresCampusProvider>
      <RosterProvider>
        <CalendarCampusProvider>{children}</CalendarCampusProvider>
      </RosterProvider>
    </ScoresCampusProvider>
  )
}

/** Backward-compatible facade merging roster + scores + calendar. */
export function useCampus(): CampusContextValue {
  const roster = useRoster()
  const scores = useScoresCampus()
  const calendar = useCalendarCampus()
  return useMemo(
    () => ({
      classes: roster.classes,
      students: roster.students,
      teachers: roster.teachers,
      campusDataLoading: roster.campusDataLoading,
      campusDataError: roster.campusDataError,
      accessibleClasses: roster.accessibleClasses,
      selectedSubjects: roster.selectedSubjects,
      toggleSelectedSubject: roster.toggleSelectedSubject,
      accessibleSubjects: roster.accessibleSubjects,
      selectedClassIds: roster.selectedClassIds,
      toggleClass: roster.toggleClass,
      selectClasses: roster.selectClasses,
      selectAllAccessible: roster.selectAllAccessible,
      clearSelection: roster.clearSelection,
      searchQuery: roster.searchQuery,
      setSearchQuery: roster.setSearchQuery,
      filteredStudents: roster.filteredStudents,
      selectedStudents: roster.selectedStudents,
      accessibleStudents: roster.accessibleStudents,
      assignClassToTeacher: roster.assignClassToTeacher,
      getClassName: roster.getClassName,
      getTeachersForClass: roster.getTeachersForClass,
      getTeacherNamesForClass: roster.getTeacherNamesForClass,
      scoresAcademicYearStart: scores.scoresAcademicYearStart,
      setScoresAcademicYearStart: scores.setScoresAcademicYearStart,
      gradeDeadlines: scores.gradeDeadlines,
      updateGradeDeadline: scores.updateGradeDeadline,
      submitGradeDeadlines: scores.submitGradeDeadlines,
      relevantDeadlines: scores.relevantDeadlines,
      taughtGradeNumbers: scores.taughtGradeNumbers,
      calendarEvents: calendar.calendarEvents,
      addCalendarEvent: calendar.addCalendarEvent,
      addCalendarEvents: calendar.addCalendarEvents,
      updateCalendarEvent: calendar.updateCalendarEvent,
      deleteCalendarEvent: calendar.deleteCalendarEvent,
      deleteCalendarEvents: calendar.deleteCalendarEvents,
      addCalendarEventsBatch: calendar.addCalendarEventsBatch,
    }),
    [roster, scores, calendar],
  )
}

export {
  useRoster,
  useScoresCampus,
  useCalendarCampus,
  RosterProvider,
  ScoresCampusProvider,
  CalendarCampusProvider,
}

export type {
  RosterContextValue,
  ScoresCampusContextValue,
  CalendarCampusContextValue,
}
