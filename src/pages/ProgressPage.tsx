import { useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { MiniCalendar } from '../components/calendar/MiniCalendar'
import { MiniCalendarDetails } from '../components/calendar/MiniCalendarDetails'
import { QuickEventInput } from '../components/calendar/QuickEventInput'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'

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
  } = useCampus()

  return (
    <div className="page progress-page home-page">
      <header className="page-header reveal-up">
        <div>
          <h1>首頁</h1>
          <p>月曆、班級概況與待辦將分欄顯示。</p>
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

        <GlassPanel className="home-col home-col-mid home-col-placeholder">
          <p className="home-placeholder-label">中欄</p>
          <p className="home-placeholder-hint">內容稍後設定</p>
        </GlassPanel>

        <GlassPanel className="home-col home-col-right home-col-placeholder">
          <p className="home-placeholder-label">右欄</p>
          <p className="home-placeholder-hint">內容稍後設定</p>
        </GlassPanel>
      </div>
    </div>
  )
}
