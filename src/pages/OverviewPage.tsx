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
    accessibleStudents,
    selectedStudents,
    selectedClassIds,
    getTeacherNamesForClass,
    students,
    classes,
    searchQuery,
    filteredStudents,
  } = useCampus()

  const searching = Boolean(searchQuery.trim())

  const scopeStudents = searching
    ? filteredStudents
    : user?.role === 'admin' && selectedClassIds.length === 0
      ? students
      : user?.role === 'teacher'
        ? accessibleStudents
        : selectedStudents

  const baseClasses =
    user?.role === 'admin' && selectedClassIds.length === 0
      ? classes
      : user?.role === 'teacher'
        ? accessibleClasses
        : accessibleClasses.filter((c) =>
            selectedClassIds.length === 0
              ? true
              : selectedClassIds.includes(c.id),
          )

  const matchClassIds = useMemo(() => {
    if (!searching) return null
    return new Set(filteredStudents.map((s) => s.classId))
  }, [searching, filteredStudents])

  const matchCountByClass = useMemo(() => {
    const map = new Map<string, number>()
    if (!searching) return map
    for (const s of filteredStudents) {
      map.set(s.classId, (map.get(s.classId) ?? 0) + 1)
    }
    return map
  }, [searching, filteredStudents])

  const scopeClasses = useMemo(() => {
    if (!matchClassIds) return baseClasses
    return baseClasses.filter((c) => matchClassIds.has(c.id))
  }, [baseClasses, matchClassIds])

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sortedClasses = useMemo(() => {
    const rows = scopeClasses.map((cls) => {
      const roster = students.filter((s) => s.classId === cls.id)
      return {
        cls,
        teacher: getTeacherNamesForClass(cls.id),
        count: roster.length,
        hits: matchCountByClass.get(cls.id) ?? 0,
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
  }, [
    scopeClasses,
    students,
    getTeacherNamesForClass,
    sortKey,
    sortDir,
    matchCountByClass,
  ])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  const metrics = [
    {
      label: searching ? '命中班級' : '涵蓋班級',
      value: String(scopeClasses.length),
    },
    {
      label: searching ? '命中學生' : '學生人數',
      value: String(scopeStudents.length),
    },
    {
      label: searching ? '命中平均 CA' : '平均 CA',
      value: String(average(scopeStudents.map((s) => s.progress))),
    },
    {
      label: searching ? '命中平均閱讀' : '平均閱讀',
      value: String(average(scopeStudents.map((s) => s.readingScore))),
    },
  ]

  return (
    <div className="page overview-page">
      <header className="page-header reveal-up">
        <h1>總覽</h1>
        <p>
          {searching
            ? `依「${searchQuery.trim()}」篩選班級與學生。`
            : user?.role === 'admin'
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
              {sortedClasses.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {searching
                      ? '沒有符合搜尋的班級。'
                      : '目前沒有可顯示的班級。'}
                  </td>
                </tr>
              ) : (
                sortedClasses.map((row) => (
                  <tr
                    key={row.cls.id}
                    className={row.hits > 0 ? 'overview-row-hit' : undefined}
                  >
                    <td>
                      {row.cls.name}
                      {row.hits > 0 ? (
                        <span className="overview-hit-badge">
                          {' '}
                          {row.hits} 命中
                        </span>
                      ) : null}
                    </td>
                    <td>{row.cls.grade}</td>
                    <td>{row.teacher}</td>
                    <td>{row.count}</td>
                    <td>{row.progress}</td>
                    <td>{row.reading}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
