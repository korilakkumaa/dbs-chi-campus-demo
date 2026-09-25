import { GlassPanel } from '../components/GlassPanel'
import { WeeklyClassTimetablePanel } from '../components/timetable/WeeklyClassTimetablePanel'
import { hasClassTimetableForYear } from '../data/classTimetable'
import {
  defaultTimetableWeekMonday,
  timetableViewStartYear,
} from '../data/teacherTimetable'

export function SchoolTimetablePage() {
  const viewStartYear = timetableViewStartYear(defaultTimetableWeekMonday())
  const hasAny = hasClassTimetableForYear(viewStartYear)

  if (!hasAny) {
    return (
      <div className="page">
        <header className="page-header reveal-up">
          <h1>全校時間表</h1>
          <p>各班每週課表；依校曆自動反映假期與調課。</p>
        </header>
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">尚未匯入全校時間表。</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>全校時間表</h1>
        <p>
          各班每週課表（含分流堂次）；依校曆自動反映假期與調課。可按年級選擇班別。
        </p>
      </header>

      <GlassPanel className="personal-tt school-tt reveal-up delay-1">
        <WeeklyClassTimetablePanel />
      </GlassPanel>
    </div>
  )
}
