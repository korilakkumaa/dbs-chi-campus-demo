import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { average } from '../data/mockData'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'

type SortKey = 'className' | 'readingScore'
type SortDir = 'asc' | 'desc'

export function ReadingPage() {
  const navigate = useNavigate()
  const { selectedStudents, filteredStudents, searchQuery, getClassName } =
    useCampus()
  const list = searchQuery.trim() ? filteredStudents : selectedStudents
  const avg = average(list.map((s) => s.readingScore))
  const [sortKey, setSortKey] = useState<SortKey>('readingScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
        <h1>閱讀</h1>
        <p>已選班級的流暢度與理解表現。</p>
      </header>

      <GlassPanel className="reading-hero-metric reveal-up delay-1">
        <p className="metric-label">班級閱讀平均</p>
        <p className="metric-value xl">{avg}%</p>
        <div className="reading-track" aria-hidden>
          <span style={{ width: `${avg}%` }} />
        </div>
      </GlassPanel>

      <GlassPanel className="table-panel reveal-up delay-2">
        <h2>閱讀排行</h2>
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
                  <td>{s.readingScore}%</td>
                  <td>
                    <div className="inline-meter reading">
                      <span
                        className="inline-fill"
                        style={{ width: `${s.readingScore}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
