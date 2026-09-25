import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { MiniCalendar } from '../components/calendar/MiniCalendar'
import { MiniCalendarDetails } from '../components/calendar/MiniCalendarDetails'
import { QuickEventInput } from '../components/calendar/QuickEventInput'
import { HomeworkAbsPanel } from '../components/homework/HomeworkAbsPanel'
import { useAuth } from '../context/AuthContext'
import { useCampus, useRoster } from '../context/CampusContext'
import { formatAcademicYearLabel } from '../data/academicYear'
import {
  defaultScoresAcademicYearStart,
} from '../data/campusScoresYear'
import { whitelistClassToCode } from '../data/gradeChineseTimetable'
import {
  gradeNumberFromClassName,
  latestTeacherWhitelistYear,
  rosterForChineseClass,
} from '../data/teacherWhitelist'
import { withScoresYearQuery } from '../hooks/useScoresAcademicYear'
import { formatScore } from '../lib/format'
import { average } from '../lib/stats'

export function ProgressPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const { user } = useAuth()
  const {
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    students,
    scoresAcademicYearStart,
    searchQuery,
    filteredStudents,
  } = useCampus()
  const { teachingAccessibleClasses, teachingYearStart, selectClasses } =
    useRoster()

  const teachingYear = teachingYearStart ?? latestTeacherWhitelistYear()
  const scoresDefaultStart = defaultScoresAcademicYearStart()
  const myClasses = useMemo(
    () => teachingAccessibleClasses ?? [],
    [teachingAccessibleClasses],
  )
  const teachingGrades = useMemo(() => {
    const grades = new Set<number>()
    for (const cls of myClasses) {
      const g = gradeNumberFromClassName(cls.name)
      if (g != null) grades.add(g)
    }
    return [...grades].sort((a, b) => a - b)
  }, [myClasses])

  const matchIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    return new Set(filteredStudents.map((s) => s.id))
  }, [searchQuery, filteredStudents])

  const matchStoredNos = useMemo(() => {
    if (!matchIds) return null
    return new Set(filteredStudents.map((s) => s.id))
  }, [matchIds, filteredStudents])

  const classProgress = useMemo(
    () =>
      myClasses.map((cls) => {
        const roster = rosterForChineseClass(
          cls.id,
          cls.name,
          students,
          scoresAcademicYearStart,
        )
        const empty = roster.length === 0
        const hits = matchIds
          ? roster.filter((s) => matchIds.has(s.id)).length
          : 0
        return {
          cls,
          count: roster.length,
          hits,
          ca: empty ? null : average(roster.map((s) => s.progress)),
          reading: empty ? null : average(roster.map((s) => s.readingScore)),
          writing: empty ? null : average(roster.map((s) => s.correctRate)),
        }
      }),
    [myClasses, students, scoresAcademicYearStart, matchIds],
  )

  const visibleClassProgress = useMemo(() => {
    if (!matchIds) return classProgress
    return classProgress.filter((row) => row.hits > 0)
  }, [classProgress, matchIds])

  const scoresLink = (classId: string) =>
    withScoresYearQuery(
      `/class/individual?class=${encodeURIComponent(classId)}`,
      scoresAcademicYearStart,
      scoresDefaultStart,
    )

  const timetableLink = (className: string) => {
    const code = whitelistClassToCode(className)
    return code
      ? `/timetable/school?class=${encodeURIComponent(code)}`
      : '/timetable/school'
  }

  return (
    <div className="page progress-page home-page">
      <header className="page-header reveal-up">
        <div>
          <h1>首頁</h1>
          <p>今天該跟進的事、任教班概況與欠交提醒。</p>
        </div>
      </header>

      <div className="home-columns reveal-up delay-1">
        <div className="home-left-stack">
          <GlassPanel className="home-col home-col-left home-cal-card">
            <div className="home-cal-split">
              <div className="home-cal-pane">
                <MiniCalendar
                  year={year}
                  monthIndex={monthIndex}
                  events={calendarEvents}
                  onMonthChange={(y, m) => {
                    setYear(y)
                    setMonthIndex(m)
                  }}
                />
              </div>
              <div className="home-cal-todo">
                <MiniCalendarDetails
                  year={year}
                  monthIndex={monthIndex}
                  events={calendarEvents}
                  user={user}
                  teachingGrades={teachingGrades}
                  onUpdateTitle={(id, title) =>
                    updateCalendarEvent(id, { title })
                  }
                  onDelete={deleteCalendarEvent}
                />
                <QuickEventInput
                  onAdd={({ title, date, kind, time }) =>
                    addCalendarEvent({ title, date, kind, time })
                  }
                />
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="home-col home-progress-panel">
            <h2 className="home-mid-title">我的任教</h2>
            <p className="deadline-admin-lead">
              教學學年 {formatAcademicYearLabel(teachingYear)}
              {scoresAcademicYearStart !== teachingYear
                ? `（成績／名冊學年為 ${formatAcademicYearLabel(scoresAcademicYearStart)}）`
                : ''}
            </p>
            {visibleClassProgress.length === 0 ? (
              <p className="home-placeholder-hint">
                {matchIds
                  ? '沒有符合搜尋的任教班。'
                  : '此學年尚未有任教班別。'}
              </p>
            ) : (
              <ul className="home-teaching-list">
                {visibleClassProgress.map(
                  ({ cls, count, hits, ca, reading, writing }) => (
                  <li
                    key={cls.id}
                    className={hits > 0 ? 'home-teaching-hit' : undefined}
                  >
                    <div className="home-teaching-main">
                      <span className="home-teaching-name">
                        {cls.name}
                        {hits > 0 ? (
                          <span className="home-teaching-hits">
                            {' '}
                            {hits} 命中
                          </span>
                        ) : null}
                      </span>
                      <span className="home-teaching-metrics">
                        <span>{count} 人</span>
                        {ca != null && <span>CA {formatScore(ca)}</span>}
                        {reading != null && (
                          <span>閱讀 {formatScore(reading)}</span>
                        )}
                        {writing != null && (
                          <span>寫作 {formatScore(writing)}</span>
                        )}
                      </span>
                    </div>
                    <span className="home-teaching-links">
                      <Link
                        to={scoresLink(cls.id)}
                        onClick={() => selectClasses([cls.id])}
                      >
                        分數
                      </Link>
                      <Link to={timetableLink(cls.name)}>時間表</Link>
                    </span>
                  </li>
                ),
                )}
              </ul>
            )}
          </GlassPanel>
        </div>

        <GlassPanel className="home-col home-col-right home-col-abs">
          <HomeworkAbsPanel
            students={students}
            restrictStudentNos={matchStoredNos}
          />
        </GlassPanel>
      </div>
    </div>
  )
}
