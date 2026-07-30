import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'
import { gradeLabel, gradeNumberFromClassName } from '../data/teacherWhitelist'
import {
  PAPER_ROWS,
  SEMESTER_LABELS,
  SUBJECT_MAX,
  buildScorePools,
  lookupPercentile,
  percentileRank,
  quartileFromPercentile,
  semesterPoints,
  subjectEarned,
  yearPoints,
  type SubjectKey,
} from '../data/yearScoring'
import type { Student, YearRecord } from '../types'

type SortKey = 'className' | 'classNumber' | 'progress' | 'correctRate'
type SortDir = 'asc' | 'desc'

function YearHistoryCharts({
  records,
  students,
}: {
  records: YearRecord[]
  students: Student[]
}) {
  const pools = useMemo(() => buildScorePools(students), [students])

  if (records.length === 0) {
    return <p className="empty-note">暫無歷年成績。</p>
  }

  return (
    <div className="year-charts" role="list" aria-label="歷年表現">
      {records.map((record) => {
        const firstTotal = semesterPoints(record.first)
        const secondTotal = semesterPoints(record.second)
        const total = yearPoints(record)
        const yearPct = percentileRank(
          total,
          pools.sameYearTotal.get(String(record.grade)) ?? [],
        )
        const yearQuartile = quartileFromPercentile(yearPct)

        return (
          <article
            key={record.grade}
            className={`year-chart year-chart-${yearQuartile}`}
            role="listitem"
          >
            <header className="year-chart-head">
              <p className="year-chart-class">{record.className}</p>
              <p className="year-chart-grade">{gradeLabel(record.grade)}</p>
            </header>

            <div className="year-chart-bars">
              {PAPER_ROWS.map(({ semester, subject, label }, index) => {
                const raw = record[semester][subject as SubjectKey]
                const max = SUBJECT_MAX[subject]
                const earned = subjectEarned(raw, subject)
                const { sameYear } = lookupPercentile(
                  pools,
                  record.grade,
                  semester,
                  subject,
                  earned,
                )
                const tone = quartileFromPercentile(sameYear)
                const fill = max > 0 ? (earned / max) * 100 : 0
                const showSemesterBreak =
                  index > 0 && PAPER_ROWS[index - 1].semester !== semester
                const sameTop = Math.max(1, 100 - sameYear)
                return (
                  <div key={`${semester}-${subject}`}>
                    {showSemesterBreak && (
                      <div className="year-semester-rule" aria-hidden />
                    )}
                    <div
                      className={`year-hbar year-hbar-${tone}`}
                      tabIndex={0}
                      aria-label={`${label} ${earned}%，Top ${sameTop}%`}
                    >
                      <span className="year-hbar-label">{label}</span>
                      <div className="year-hbar-track" aria-hidden>
                        <span
                          className="year-hbar-fill"
                          style={{ width: `${Math.max(4, fill)}%` }}
                        />
                      </div>
                      <strong className="year-hbar-score">{earned}%</strong>
                      <div className="year-hbar-tip" role="tooltip">
                        Top {sameTop}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <dl className="year-chart-summary">
              <div>
                <dt>{SEMESTER_LABELS.first}</dt>
                <dd>{firstTotal}%</dd>
              </div>
              <div>
                <dt>{SEMESTER_LABELS.second}</dt>
                <dd>{secondTotal}%</dd>
              </div>
              <div className="year-chart-summary-total">
                <dt>學年總分</dt>
                <dd>{total}%</dd>
              </div>
            </dl>
            <p className="year-chart-top">
              Top {Math.max(1, 100 - yearPct)}%
            </p>
          </article>
        )
      })}
    </div>
  )
}

function StudentFileCard({
  student,
  students,
  getClassName,
}: {
  student: Student
  students: Student[]
  getClassName: (classId: string) => string
}) {
  return (
    <GlassPanel className="student-file reveal-up delay-2">
      <div className="file-head">
        <div className="file-identity">
          <h2>{student.name}</h2>
          <dl className="file-meta">
            <div>
              <dt>班別</dt>
              <dd>{getClassName(student.classId)}</dd>
            </div>
            <div>
              <dt>學號</dt>
              <dd>{String(student.classNumber).padStart(2, '0')}</dd>
            </div>
          </dl>
        </div>
        <div className="file-score">
          <span>{student.progress}%</span>
          <small>進度</small>
        </div>
      </div>

      <dl className="file-stats">
        <div>
          <dt>閱讀</dt>
          <dd>{student.readingScore}%</dd>
        </div>
        <div>
          <dt>答對率</dt>
          <dd>{student.correctRate}%</dd>
        </div>
      </dl>

      <section className="file-section">
        <h3>近期成績</h3>
        <YearHistoryCharts
          records={student.yearHistory}
          students={students}
        />
      </section>
    </GlassPanel>
  )
}

const SCORE_HELP =
  '各年顯示上／下學期的 CA（最高 20%）、閱讀（最高 40%）、寫作（最高 45%）。柱長按該項滿分比例；游標移到柱上可看該分卷同年 Top XX%。學年總分以上學期 35%、下學期 65% 加權。'

export function IndividualPage() {
  const [searchParams] = useSearchParams()
  const {
    filteredStudents,
    selectedStudents,
    searchQuery,
    getClassName,
    students,
    classes,
  } = useCampus()
  const list = searchQuery.trim() ? filteredStudents : selectedStudents
  const requestedId = searchParams.get('student')
  const [compareIds, setCompareIds] = useState<string[]>(
    requestedId ? [requestedId] : [],
  )
  const [rosterGrade, setRosterGrade] = useState<number | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('className')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!requestedId) return
    setCompareIds((prev) =>
      prev.includes(requestedId) ? prev : [...prev, requestedId],
    )
  }, [requestedId])

  useEffect(() => {
    if (!helpOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelpOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [helpOpen])

  const classGradeById = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const c of classes) {
      map.set(c.id, gradeNumberFromClassName(c.name))
    }
    return map
  }, [classes])

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

  const availableGrades = useMemo(() => {
    const grades = new Set<number>()
    for (const s of baseRoster) {
      const g = classGradeById.get(s.classId)
      if (g != null) grades.add(g)
    }
    return [...grades].sort((a, b) => a - b)
  }, [baseRoster, classGradeById])

  useEffect(() => {
    if (rosterGrade === 'all') return
    if (!availableGrades.includes(rosterGrade)) {
      setRosterGrade('all')
    }
  }, [availableGrades, rosterGrade])

  const gradeFiltered = useMemo(() => {
    if (rosterGrade === 'all') return baseRoster
    return baseRoster.filter(
      (s) => classGradeById.get(s.classId) === rosterGrade,
    )
  }, [baseRoster, rosterGrade, classGradeById])

  const roster = useMemo(() => {
    const rows = [...gradeFiltered]
    const factor = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'className') {
        cmp = getClassName(a.classId).localeCompare(
          getClassName(b.classId),
          'en',
        )
      } else if (sortKey === 'classNumber') {
        cmp = a.classNumber - b.classNumber
      } else {
        cmp = a[sortKey] - b[sortKey]
      }
      if (cmp === 0) {
        cmp =
          getClassName(a.classId).localeCompare(getClassName(b.classId), 'en') ||
          a.classNumber - b.classNumber
      }
      return cmp * factor
    })
    return rows
  }, [gradeFiltered, sortKey, sortDir, getClassName])

  const compareStudents = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]))
    return compareIds
      .map((id) => byId.get(id))
      .filter((s): s is Student => Boolean(s))
  }, [compareIds, students])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const removeCompare = (id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id))
  }

  return (
    <div className="page individual-page">
      <header className="page-header reveal-up">
        <div className="page-header-title">
          <h1>個人</h1>
          <div className="page-help" ref={helpRef}>
            <button
              type="button"
              className={`page-help-btn${helpOpen ? ' open' : ''}`}
              aria-expanded={helpOpen}
              aria-controls="individual-score-help"
              onClick={() => setHelpOpen((o) => !o)}
            >
              ?
              <span className="sr-only">近期成績說明</span>
            </button>
            {helpOpen && (
              <div
                id="individual-score-help"
                className="page-help-panel"
                role="dialog"
                aria-label="近期成績說明"
              >
                <p>{SCORE_HELP}</p>
              </div>
            )}
          </div>
        </div>
        <p>勾選名冊學生以對比檔案；可用年級篩選名冊。</p>
      </header>

      <div className="individual-layout">
        <GlassPanel className="compare-tray reveal-up delay-1">
          <div className="compare-tray-head">
            <h2>已選</h2>
            {compareStudents.length > 0 && (
              <button
                type="button"
                className="compare-tray-clear"
                onClick={() => setCompareIds([])}
              >
                清除
              </button>
            )}
          </div>
          {compareStudents.length === 0 ? (
            <p className="compare-tray-empty">在名冊勾選同學作對比</p>
          ) : (
            <ul className="compare-tray-list">
              {compareStudents.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="compare-tray-item"
                    onClick={() => removeCompare(s.id)}
                    title="移出對比"
                  >
                    <span className="compare-tray-class">
                      {getClassName(s.classId)}
                    </span>
                    <span className="compare-tray-num">
                      {String(s.classNumber).padStart(2, '0')}
                    </span>
                    <span className="compare-tray-name">{s.name}</span>
                    <span className="compare-tray-remove" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="roster-rail reveal-up delay-1">
          <div className="roster-rail-head">
            <h2>名冊</h2>
            <label className="roster-grade-filter">
              <span className="sr-only">年級</span>
              <select
                value={rosterGrade === 'all' ? 'all' : String(rosterGrade)}
                onChange={(e) => {
                  const v = e.target.value
                  setRosterGrade(v === 'all' ? 'all' : Number(v))
                }}
                aria-label="篩選年級"
              >
                <option value="all">全部年級</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="roster-table" role="table" aria-label="學生名冊">
            <div className="roster-row roster-row-head" role="row">
              <div className="roster-col check" role="columnheader">
                <span className="sr-only">選取</span>
              </div>
              <div className="roster-col class" role="columnheader">
                <SortHeader
                  as="div"
                  label="班別"
                  column="className"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
              </div>
              <div className="roster-col number" role="columnheader">
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
              {roster.map((s) => {
                const selected = compareIds.includes(s.id)
                return (
                  <li key={s.id}>
                    <label
                      className={`roster-row roster-item${selected ? ' active' : ''}`}
                    >
                      <span className="roster-col check">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCompare(s.id)}
                          aria-label={`選取 ${getClassName(s.classId)} ${String(s.classNumber).padStart(2, '0')} ${s.name}`}
                        />
                      </span>
                      <span className="roster-col class">
                        {getClassName(s.classId)}
                      </span>
                      <span className="roster-col number">
                        {String(s.classNumber).padStart(2, '0')}
                      </span>
                      <span className="roster-col name">{s.name}</span>
                      <span className="roster-col metric">{s.progress}%</span>
                      <span className="roster-col metric">{s.correctRate}%</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </GlassPanel>

        <div className="student-file-stage">
          {compareStudents.length === 0 ? (
            <GlassPanel className="empty-panel">
              <p>在名冊勾選一位或多位同學以檢視／對比。</p>
            </GlassPanel>
          ) : (
            <div className="student-file-compare">
              {compareStudents.map((s) => (
                <StudentFileCard
                  key={s.id}
                  student={s}
                  students={students}
                  getClassName={getClassName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
