import { useMemo, useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { WeeklyTimetablePanel } from '../components/timetable/WeeklyTimetablePanel'
import { useAuth } from '../context/AuthContext'
import {
  defaultTimetableWeekMonday,
  listTeachersWithTimetables,
  resolveTimetableTeacherId,
  timetableViewStartYear,
} from '../data/teacherTimetable'

export function PersonalTimetablePage() {
  const { user } = useAuth()
  const viewStartYear = timetableViewStartYear(defaultTimetableWeekMonday())
  const teachersForYear = useMemo(
    () => listTeachersWithTimetables(viewStartYear),
    [viewStartYear],
  )
  const hasAnyTimetable = useMemo(() => listTeachersWithTimetables().length > 0, [])
  const ownTeacherId = resolveTimetableTeacherId(user?.id, user?.role)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (ownTeacherId) return new Set([ownTeacherId])
    const first = teachersForYear[0]?.teacherId
    return first ? new Set([first]) : new Set()
  })

  if (!hasAnyTimetable) {
    return (
      <div className="page">
        <header className="page-header reveal-up">
          <h1>個人時間表</h1>
          <p>任教堂次與個人時間表。</p>
        </header>
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">尚未匯入時間表。</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>個人時間表</h1>
        <p>
          本週任教堂次；依校曆自動反映假期與調課。⌘／Ctrl 多選老師以比對共同空堂。
        </p>
      </header>

      <GlassPanel className="personal-tt reveal-up delay-1">
        <WeeklyTimetablePanel
          multiSelect
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      </GlassPanel>
    </div>
  )
}
