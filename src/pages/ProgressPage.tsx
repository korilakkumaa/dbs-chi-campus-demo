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
import { latestTeacherWhitelistYear } from '../data/teacherWhitelist'

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
  } = useCampus()
  const { teachingAccessibleClasses, teachingYearStart } = useRoster()

  const teachingYear = teachingYearStart ?? latestTeacherWhitelistYear()
  const myClasses = useMemo(
    () => teachingAccessibleClasses ?? [],
    [teachingAccessibleClasses],
  )

  return (
    <div className="page progress-page home-page">
      <header className="page-header reveal-up">
        <div>
          <h1>首頁</h1>
          <p>月曆、我的任教與欠交習作提醒分欄顯示。</p>
        </div>
      </header>

      <div className="home-columns reveal-up delay-1">
        <GlassPanel className="home-col home-col-left">
          <MiniCalendar
            year={year}
            monthIndex={monthIndex}
            events={calendarEvents}
            onMonthChange={(y, m) => {
              setYear(y)
              setMonthIndex(m)
            }}
          />
          <MiniCalendarDetails
            year={year}
            monthIndex={monthIndex}
            events={calendarEvents}
            user={user}
            onUpdateTitle={(id, title) => updateCalendarEvent(id, { title })}
            onDelete={deleteCalendarEvent}
          />
          <QuickEventInput
            onAdd={({ title, date, kind }) =>
              addCalendarEvent({ title, date, kind })
            }
          />
        </GlassPanel>

        <GlassPanel className="home-col home-col-mid">
          <h2 className="home-mid-title">我的任教</h2>
          <p className="deadline-admin-lead">
            教學學年 {formatAcademicYearLabel(teachingYear)}
            {scoresAcademicYearStart !== teachingYear
              ? `（成績／名冊學年為 ${formatAcademicYearLabel(scoresAcademicYearStart)}）`
              : ''}
          </p>
          {myClasses.length === 0 ? (
            <p className="home-placeholder-hint">此學年尚未有任教班別。</p>
          ) : (
            <ul className="home-teaching-list">
              {myClasses.map((cls) => (
                <li key={cls.id}>
                  <span className="home-teaching-name">{cls.name}</span>
                  <span className="home-teaching-links">
                    <Link to="/class">分數</Link>
                    <Link to="/timetable">時間表</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="home-col home-col-right home-col-abs">
          <HomeworkAbsPanel students={students} />
        </GlassPanel>
      </div>
    </div>
  )
}
