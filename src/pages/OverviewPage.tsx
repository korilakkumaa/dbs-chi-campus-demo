import { useMemo, useState } from 'react'
import { average } from '../lib/stats'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'

type SortKey = 'name' | 'grade' | 'teacher' | 'count' | 'progress' | 'reading'
type SortDir = 'asc' | 'desc'

export function OverviewPage() {
  const { user } = useAuth()
  const {
    accessibleClasses,
    selectedStudents,
    selectedClassIds,
    getTeacherNamesForClass,
    students,
    classes,
  } = useCampus()

  const scopeStudents =
    user?.role === 'admin' && selectedClassIds.length === 0
      ? students
      : selectedStudents

  const scopeClasses =
    user?.role === 'admin' && selectedClassIds.length === 0
      ? classes
      : accessibleClasses.filter((c) =>
          selectedClassIds.length === 0
            ? true
            : selectedClassIds.includes(c.id),
        )

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sortedClasses = useMemo(() => {
    const rows = scopeClasses.map((cls) => {
      const roster = students.filter((s) => s.classId === cls.id)
      return {
        cls,
        teacher: getTeacherNamesForClass(cls.id),
        count: roster.length,
        progress: average(roster.map((s) => s.progress)),
        reading: average(roster.map((s) => s.readingScore)),
      }
    })
    const factor = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.cls.name.localeCompare(b.cls.name, 'en', { numeric: true })
      } else if (sortKey === 'grade') {
        cmp = a.cls.grade.localeCompare(b.cls.grade, 'zh-Hant')
      } else if (sortKey === 'teacher') {
        cmp = a.teacher.localeCompare(b.teacher, 'zh-Hant')
      } else if (sortKey === 'count') {
        cmp = a.count - b.count
      } else if (sortKey === 'progress') {
        cmp = a.progress - b.progress
      } else {
        cmp = a.reading - b.reading
      }
      if (cmp === 0) {
        cmp = a.cls.name.localeCompare(b.cls.name, 'en', { numeric: true })
      }
      return cmp * factor
    })
    return rows
  }, [scopeClasses, students, getTeacherNamesForClass, sortKey, sortDir])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  const metrics = [
    {
      label: '涵蓋班級',
      value: String(scopeClasses.length),
    },
    {
      label: '學生人數',
      value: String(scopeStudents.length),
    },
    {
      label: '平均 CA',
      value: String(average(scopeStudents.map((s) => s.progress))),
    },
    {
      label: '平均閱讀',
      value: String(average(scopeStudents.map((s) => s.readingScore))),
    },
  ]

  return (
    <div className="page overview-page">
      <header className="page-header reveal-up">
        <h1>總覽</h1>
        <p>
          {user?.role === 'admin'
            ? '全校已分派班級的整體概況。'
            : '你任教班級的平靜摘要。'}
        </p>
      </header>

      <div className="metric-row reveal-up delay-1">
        {metrics.map((m) => (
          <GlassPanel key={m.label} className="metric">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value">{m.value}</p>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel className="table-panel reveal-up delay-2">
        <h2>班級一覽</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader
                  label="班級"
                  column="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="年級"
                  column="grade"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="教師"
                  column="teacher"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="學生人數"
                  column="count"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="CA"
                  column="progress"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="閱讀"
                  column="reading"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedClasses.map((row) => (
                <tr key={row.cls.id}>
                  <td>{row.cls.name}</td>
                  <td>{row.cls.grade}</td>
                  <td>{row.teacher}</td>
                  <td>{row.count}</td>
                  <td>{row.progress}</td>
                  <td>{row.reading}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
