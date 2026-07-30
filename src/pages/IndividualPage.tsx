import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'

type SortKey = 'classNumber' | 'progress' | 'correctRate'
type SortDir = 'asc' | 'desc'

export function IndividualPage() {
  const [searchParams] = useSearchParams()
  const {
    filteredStudents,
    selectedStudents,
    searchQuery,
    getClassName,
    students,
  } = useCampus()
  const list = searchQuery.trim() ? filteredStudents : selectedStudents
  const requestedId = searchParams.get('student')
  const [activeId, setActiveId] = useState<string | null>(requestedId)
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (requestedId) setActiveId(requestedId)
  }, [requestedId])

  const baseRoster = useMemo(() => {
    if (list.length === 0) return [] as typeof list
    const requested = requestedId
      ? students.find((s) => s.id === requestedId)
      : null
    if (requested && !list.some((s) => s.id === requested.id)) {
      return [requested, ...list]
    }
    return list
  }, [list, requestedId, students])

  const roster = useMemo(() => {
    const rows = [...baseRoster]
    const factor = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'classNumber') {
        const ca = getClassName(a.classId)
        const cb = getClassName(b.classId)
        cmp = ca.localeCompare(cb, 'en') || a.classNumber - b.classNumber
      } else {
        cmp = a[sortKey] - b[sortKey]
      }
      if (cmp === 0) cmp = a.classNumber - b.classNumber
      return cmp * factor
    })
    return rows
  }, [baseRoster, sortKey, sortDir, getClassName])

  const active = useMemo(() => {
    if (roster.length === 0) return null
    const found = roster.find((s) => s.id === activeId)
    return found ?? roster[0]
  }, [roster, activeId])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  return (
    <div className="page individual-page">
      <header className="page-header reveal-up">
        <h1>個人</h1>
        <p>從目前班級中開啟學生檔案。</p>
      </header>

      <div className="individual-layout">
        <GlassPanel className="roster-rail reveal-up delay-1">
          <h2>名冊</h2>
          <div className="roster-table" role="table" aria-label="學生名冊">
            <div className="roster-row roster-row-head" role="row">
              <div className="roster-col id" role="columnheader">
                <SortHeader
                  as="div"
                  label="學號"
                  column="classNumber"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
              </div>
              <div className="roster-col name" role="columnheader">
                姓名
              </div>
              <div className="roster-col metric" role="columnheader">
                <SortHeader
                  as="div"
                  label="進度"
                  column="progress"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
              </div>
              <div className="roster-col metric" role="columnheader">
                <SortHeader
                  as="div"
                  label="答對率"
                  column="correctRate"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
              </div>
            </div>
            <ul className="roster-list">
              {roster.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`roster-row roster-item${active?.id === s.id ? ' active' : ''}`}
                    onClick={() => setActiveId(s.id)}
                  >
                    <span className="roster-col id">
                      {getClassName(s.classId)}
                      {String(s.classNumber).padStart(2, '0')}
                    </span>
                    <span className="roster-col name">{s.name}</span>
                    <span className="roster-col metric">{s.progress}%</span>
                    <span className="roster-col metric">{s.correctRate}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>

        {active ? (
          <GlassPanel className="student-file reveal-up delay-2">
            <div className="file-head">
              <div className="file-identity">
                <h2>{active.name}</h2>
                <dl className="file-meta">
                  <div>
                    <dt>班別</dt>
                    <dd>{getClassName(active.classId)}</dd>
                  </div>
                  <div>
                    <dt>學號</dt>
                    <dd>{String(active.classNumber).padStart(2, '0')}</dd>
                  </div>
                </dl>
              </div>
              <div className="file-score">
                <span>{active.progress}%</span>
                <small>進度</small>
              </div>
            </div>

            <dl className="file-stats">
              <div>
                <dt>閱讀</dt>
                <dd>{active.readingScore}%</dd>
              </div>
              <div>
                <dt>答對率</dt>
                <dd>{active.correctRate}%</dd>
              </div>
            </dl>

            <section className="file-section">
              <h3>近期成績</h3>
              <ul className="score-list">
                {active.recentScores.map((r) => (
                  <li key={r.label}>
                    <span>{r.label}</span>
                    <strong>{r.score}</strong>
                    <div className="mini-meter">
                      <span style={{ width: `${r.score}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="file-section">
              <h3>強項</h3>
              <p className="file-strengths">{active.strengths.join(' · ')}</p>
            </section>

            <p className="file-notes">{active.notes}</p>
          </GlassPanel>
        ) : (
          <GlassPanel className="empty-panel">
            <p>沒有符合目前篩選條件的學生。</p>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}
