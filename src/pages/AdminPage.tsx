import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { defaultPath, useAuth } from '../context/AuthContext'
import { canAccessAdminConsole } from '../lib/permissions'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { AdminCalendarBatchPanel } from '../components/admin/AdminCalendarBatchPanel'
import { AdminClassAssignPanel } from '../components/admin/AdminClassAssignPanel'
import { AdminDeadlinesPanel } from '../components/admin/AdminDeadlinesPanel'
import { AdminPapersDutyStatus } from '../components/admin/AdminPapersDutyStatus'
import { isoDateLocal, SCHOOL_CALENDAR_YEARS } from '../data/calendarEvents'
import {
  academicYearDateRange,
  formatAcademicYearLabel,
} from '../data/academicYear'
import { buildSchoolClasses } from '../data/schoolClasses'
import { teachersForYear } from '../data/staffUsers'
import {
  latestTeacherWhitelistYear,
  teacherWhitelistYears,
} from '../data/teacherWhitelist'

function listAdminYearStarts(): number[] {
  return [...new Set([...teacherWhitelistYears(), ...SCHOOL_CALENDAR_YEARS])].sort(
    (a, b) => b - a,
  )
}

function defaultDateForYear(startYear: number): string {
  const { from, to } = academicYearDateRange(startYear)
  const today = isoDateLocal()
  if (today >= from && today <= to) return today
  return from
}

export function AdminPage() {
  const { user } = useAuth()
  const {
    classes,
    students,
    assignClassToTeacher,
    gradeDeadlines,
    updateGradeDeadline,
    submitGradeDeadlines,
    addCalendarEventsBatch,
    scoresAcademicYearStart,
  } = useCampus()

  const yearOptions = useMemo(() => listAdminYearStarts(), [])
  const defaultStart = useMemo(() => latestTeacherWhitelistYear(), [])
  const [startYear, setStartYear] = useState(defaultStart)
  const yearRange = useMemo(
    () => academicYearDateRange(startYear),
    [startYear],
  )
  const yearLabel = formatAcademicYearLabel(startYear)
  const yearTeachers = useMemo(() => teachersForYear(startYear), [startYear])
  const yearClasses = useMemo(() => {
    const catalog = buildSchoolClasses(startYear)
    if (startYear !== scoresAcademicYearStart) return catalog
    const assigned = new Map(classes.map((c) => [c.id, c.teacherId]))
    return catalog.map((cls) => ({
      ...cls,
      teacherId: assigned.get(cls.id) ?? cls.teacherId,
    }))
  }, [startYear, scoresAcademicYearStart, classes])
  const canAssignClasses = startYear === scoresAcademicYearStart

  if (!canAccessAdminConsole(user)) {
    return <Navigate to={defaultPath(user?.role)} replace />
  }

  const teacherCards = yearTeachers.map((t) => {
    const owned = yearClasses.filter(
      (c) => c.teacherId === t.id || t.classIds.includes(c.id),
    )
    return { teacher: t, owned }
  })

  return (
    <div className="page admin-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>分派</h1>
          <p>
            {yearLabel}學年 · 檢視該年教師與任教班別；批量加入的活動會進入該學年日曆（
            {yearRange.from} 至 {yearRange.to}）。
          </p>
        </div>
        <ScoresYearSelect
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={setStartYear}
          id="admin-academic-year"
        />
      </header>

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">教師人數</p>
          <p className="metric-value">{yearTeachers.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">任教多班</p>
          <p className="metric-value">
            {teacherCards.filter((t) => t.owned.length > 1).length}
          </p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">班級總數</p>
          <p className="metric-value">{yearClasses.length}</p>
        </GlassPanel>
      </div>

      <AdminPapersDutyStatus startYear={startYear} />

      <AdminCalendarBatchPanel
        startYear={startYear}
        yearLabel={yearLabel}
        yearRange={yearRange}
        yearTeachers={yearTeachers}
        defaultDate={defaultDateForYear(startYear)}
        addCalendarEventsBatch={addCalendarEventsBatch}
      />

      <AdminDeadlinesPanel
        gradeDeadlines={gradeDeadlines}
        updateGradeDeadline={updateGradeDeadline}
        submitGradeDeadlines={submitGradeDeadlines}
      />

      <AdminClassAssignPanel
        yearClasses={yearClasses}
        yearTeachers={yearTeachers}
        teacherCards={teacherCards}
        students={students}
        canAssignClasses={canAssignClasses}
        scoresAcademicYearStart={scoresAcademicYearStart}
        assignClassToTeacher={assignClassToTeacher}
      />
    </div>
  )
}
