import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { average } from '../lib/stats'
import { useCampus } from '../context/CampusContext'
import { useAuth } from '../context/AuthContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'
import {
  GRADE_LEVELS,
  gradeLabel,
  gradeNumberFromClassName,
} from '../data/teacherWhitelist'

type SortKey = 'className' | 'readingScore'
type SortDir = 'asc' | 'desc'
type GradeFilter = number | 'all'

export function ReadingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    selectedStudents,
    filteredStudents,
    accessibleStudents,
    selectedClassIds,
    searchQuery,
    getClassName,
  } = useCampus()
  const scopeStudents =
    user?.role === 'admin' && selectedClassIds.length === 0
      ? accessibleStudents
      : selectedStudents
  const baseList = searchQuery.trim() ? filteredStudents : scopeStudents

  const gradeOf = (classId: string) =>
    gradeNumberFromClassName(getClassName(classId))

  const availableGrades = useMemo(() => {
    const present = new Set<number>()
    for (const s of baseList) {
      const g = gradeOf(s.classId)
      if (g != null) present.add(g)
    }
    return GRADE_LEVELS.filter((g) => present.has(g))
  }, [baseList, getClassName])

  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('readingScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    if (gradeFilter !== 'all' && !availableGrades.some((g) => g === gradeFilter)) {
      setGradeFilter('all')
    }
  }, [availableGrades, gradeFilter])

  const list = useMemo(() => {
    if (gradeFilter === 'all') return baseList
    return baseList.filter((s) => gradeOf(s.classId) === gradeFilter)
  }, [baseList, gradeFilter, getClassName])

  const avg = average(list.map((s) => s.readingScore))

  const gradeCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const s of baseList) {
      const g = gradeOf(s.classId)
      if (g == null) continue
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    return counts
  }, [baseList, getClassName])

  const sorted = useMemo(() => {
    const rows = [...list]
    const factor = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'className') {
        cmp =
          getClassName(a.classId).localeCompare(getClassName(b.classId), 'en', {
            numeric: true,
          }) || a.classNumber - b.classNumber
      } else {
        cmp = a.readingScore - b.readingScore
      }
      if (cmp === 0) cmp = a.classNumber - b.classNumber
      return cmp * factor
    })
    return rows
  }, [list, sortKey, sortDir, getClassName])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  const openStudent = (studentId: string) => {
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }

  return (
    <div className="page reading-page">
      <header className="page-header reveal-up">
        <h1>廣泛閱讀</h1>
        <p>已選班級的流暢度與理解表現；可按年級篩選。</p>
      </header>

      {availableGrades.length > 0 && (
        <div
          className="class-page-grades reading-grades reveal-up delay-1"
          role="tablist"
          aria-label="年級"
        >
          <button
            type="button"
            role="tab"
            aria-selected={gradeFilter === 'all'}
            className={`class-tt-grade${gradeFilter === 'all' ? ' active' : ''}`}
            onClick={() => setGradeFilter('all')}
          >
            全部
            <span className="class-page-grade-count">{baseList.length}</span>
          </button>
          {availableGrades.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={gradeFilter === g}
              className={`class-tt-grade${gradeFilter === g ? ' active' : ''}`}
              onClick={() => setGradeFilter(g)}
            >
              {gradeLabel(g)}
              <span className="class-page-grade-count">
                {gradeCounts.get(g) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      <GlassPanel className="reading-hero-metric reveal-up delay-1">
        <p className="metric-label">
          {gradeFilter === 'all'
            ? '閱讀平均'
            : `${gradeLabel(gradeFilter)} 閱讀平均`}
        </p>
        <p className="metric-value xl">{avg}</p>
        <div className="reading-track" aria-hidden>
          <span style={{ width: `${Math.min(100, (avg / 40) * 100)}%` }} />
        </div>
      </GlassPanel>

      <GlassPanel className="table-panel reveal-up delay-2">
        <h2>閱讀排行</h2>
        {sorted.length === 0 ? (
          <p className="empty-note">此年級沒有可顯示的學生。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名次</th>
                  <th>姓名</th>
                  <SortHeader
                    label="班級"
                    column="className"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <SortHeader
                    label="分數"
                    column="readingScore"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <th>表現</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr
                    key={s.id}
                    className="table-row-link"
                    tabIndex={0}
                    role="link"
                    aria-label={`開啟 ${s.name} 的個人檔案`}
                    onClick={() => openStudent(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openStudent(s.id)
                      }
                    }}
                  >
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>
                      {getClassName(s.classId)}
                      {String(s.classNumber).padStart(2, '0')}
                    </td>
                    <td>{s.readingScore}</td>
                    <td>
                      <div className="inline-meter reading">
                        <span
                          className="inline-fill"
                          style={{
                            width: `${Math.min(100, (s.readingScore / 40) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
