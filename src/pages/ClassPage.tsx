import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import { average } from '../data/mockData'
import {
  GRADE_LEVELS,
  formClassLetterRank,
  gradeLabel,
  gradeNumberFromClassName,
  parseClassMeta,
  remedialClassNote,
  rosterForChineseClass,
} from '../data/teacherWhitelist'
import type { SchoolClass } from '../types'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'

function sortClassesForDisplay(a: SchoolClass, b: SchoolClass): number {
  const metaA = parseClassMeta(a.name)
  const metaB = parseClassMeta(b.name)
  if (metaA.kind !== metaB.kind) return metaA.kind === 'form' ? -1 : 1
  if (metaA.kind === 'form') {
    const letterA = a.name.slice(-1)
    const letterB = b.name.slice(-1)
    return formClassLetterRank(letterA) - formClassLetterRank(letterB)
  }
  return a.name.localeCompare(b.name, 'zh-Hant')
}

function parseStartYearParam(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null
  return Math.trunc(n)
}

export function ClassPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    accessibleClasses,
    students,
    getClassName,
    getTeacherNamesForClass,
  } = useCampus()

  const yearOptions = useMemo(() => listAcademicYearStarts(), [])
  const defaultStart = useMemo(() => defaultAcademicYearStart(), [])
  const startYear = useMemo(() => {
    const param = parseStartYearParam(searchParams.get('year'))
    if (param != null && yearOptions.includes(param)) return param
    return defaultStart
  }, [searchParams, yearOptions, defaultStart])

  const onSelectYear = (next: number) => {
    if (next === defaultStart) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ year: String(next) }, { replace: true })
    }
  }

  const pool = useMemo(
    () =>
      accessibleClasses.filter((c) => parseClassMeta(c.name).kind === 'form'),
    [accessibleClasses],
  )

  const availableGrades = useMemo(() => {
    const grades = new Set<number>()
    for (const cls of pool) {
      const g = gradeNumberFromClassName(cls.name)
      if (g != null) grades.add(g)
    }
    return GRADE_LEVELS.filter((g) => grades.has(g))
  }, [pool])

  const [grade, setGrade] = useState<number>(() => availableGrades[0] ?? 7)

  useEffect(() => {
    if (availableGrades.length > 0 && !availableGrades.some((g) => g === grade)) {
      setGrade(availableGrades[0])
    }
  }, [availableGrades, grade])

  const active = useMemo(
    () =>
      pool
        .filter((c) => gradeNumberFromClassName(c.name) === grade)
        .sort(sortClassesForDisplay),
    [pool, grade],
  )

  const openStudent = (studentId: string) => {
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }

  const openClassIndividual = (classId: string) => {
    navigate(`/class/individual?class=${encodeURIComponent(classId)}`)
  }

  return (
    <div className="page class-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>班級</h1>
          <p>
            {formatAcademicYearLabel(startYear)}學年 · 並排檢視已選班級的概況。點擊班級卡片可開啟該班個人頁；點擊成長條可開啟該生檔案。
          </p>
        </div>
        <label className="year-ov-select-wrap">
          <span className="year-ov-select-label">學年</span>
          <select
            className="year-ov-select"
            value={startYear}
            onChange={(e) => onSelectYear(Number(e.target.value))}
            aria-label="選擇學年"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {formatAcademicYearLabel(y)}
                {y === defaultStart ? '（目前）' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      {availableGrades.length > 0 && (
        <div
          className="class-page-grades reveal-up delay-1"
          role="tablist"
          aria-label="年級"
        >
          {availableGrades.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={grade === g}
              className={`class-tt-grade${grade === g ? ' active' : ''}`}
              onClick={() => setGrade(g)}
            >
              {gradeLabel(g)}
              <span className="class-page-grade-count">
                {
                  pool.filter((c) => gradeNumberFromClassName(c.name) === g)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="class-grid class-grid-five">
        {active.map((cls, i) => {
          const roster = rosterForChineseClass(cls.id, cls.name, students)
          const avgP = average(roster.map((s) => s.progress))
          const avgR = average(roster.map((s) => s.readingScore))
          const avgA = average(roster.map((s) => s.correctRate))
          const remedialNote = remedialClassNote(cls.name)
          return (
            <GlassPanel
              key={cls.id}
              className={`class-snapshot class-snapshot-link class-snapshot-compact reveal-up delay-${Math.min(i + 1, 3)}`}
            >
              <div
                className="class-snapshot-body"
                onClick={() => openClassIndividual(cls.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openClassIndividual(cls.id)
                  }
                }}
                role="link"
                tabIndex={0}
                aria-label={`開啟 ${cls.name} 個人頁`}
              >
              <div className="snapshot-head">
                <h2>{cls.name}</h2>
                <p>{remedialNote ?? cls.grade}</p>
              </div>
              <p className="snapshot-teacher">
                {getTeacherNamesForClass(cls.id)}
              </p>
              <dl className="snapshot-stats">
                <div>
                  <dt>人數</dt>
                  <dd>{roster.length}</dd>
                </div>
                <div>
                  <dt>CA</dt>
                  <dd>{avgP}</dd>
                </div>
                <div>
                  <dt>閱讀</dt>
                  <dd>{avgR}</dd>
                </div>
                <div>
                  <dt>寫作</dt>
                  <dd>{avgA}</dd>
                </div>
              </dl>
              <div
                className="spark-row"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {roster.slice(0, 12).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="spark"
                    style={{
                      height: `${Math.max(18, (s.progress / 20) * 100 * 0.7)}%`,
                    }}
                    data-tip={`${s.name}：CA ${s.progress}`}
                    aria-label={`開啟 ${s.name} 的個人檔案，CA ${s.progress}`}
                    onClick={() => openStudent(s.id)}
                  />
                ))}
              </div>
              <p className="snapshot-foot">
                點擊卡片開啟{getClassName(cls.id)}個人頁 · 點擊長條開啟個人檔案
              </p>
              </div>
            </GlassPanel>
          )
        })}
        {active.length === 0 && (
          <GlassPanel className="empty-panel">
            <p>請於上方選擇一個或多個班級以查看概況。</p>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}
