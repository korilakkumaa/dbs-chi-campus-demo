import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatAcademicYearLabel } from '../data/academicYear'
import { average } from '../lib/stats'
import { formatScore } from '../lib/format'
import {
  semesterMaxForGrade,
  semesterWeightedTotal,
} from '../data/yearScoring'
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
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import {
  useScoresAcademicYear,
  withScoresYearQuery,
} from '../hooks/useScoresAcademicYear'

function sortClassesForDisplay(
  a: SchoolClass,
  b: SchoolClass,
  academicYearStart: number,
): number {
  const metaA = parseClassMeta(a.name)
  const metaB = parseClassMeta(b.name)
  if (metaA.kind !== metaB.kind) return metaA.kind === 'form' ? -1 : 1
  if (metaA.kind === 'form') {
    const gradeA = gradeNumberFromClassName(a.name)
    const gradeB = gradeNumberFromClassName(b.name)
    const letterA = a.name.match(/^(\d+)R/i) ? 'R' : a.name.slice(-1)
    const letterB = b.name.match(/^(\d+)R/i) ? 'R' : b.name.slice(-1)
    const rank =
      formClassLetterRank(letterA, gradeA ?? undefined, academicYearStart) -
      formClassLetterRank(letterB, gradeB ?? undefined, academicYearStart)
    if (rank !== 0) return rank
    return a.name.localeCompare(b.name, 'en')
  }
  return a.name.localeCompare(b.name, 'zh-Hant')
}

export function ClassPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    startYear,
    onSelectYear,
    yearOptions,
    defaultStart,
    campusDataLoading,
    campusDataError,
  } = useScoresAcademicYear()
  const {
    accessibleClasses,
    students,
    getClassName,
    getTeacherNamesForClass,
  } = useCampus()

  const pool = useMemo(() => {
    const form = accessibleClasses.filter(
      (c) => parseClassMeta(c.name).kind === 'form',
    )
    if (students.length === 0) return form
    return form.filter(
      (c) =>
        rosterForChineseClass(c.id, c.name, students, startYear).length > 0,
    )
  }, [accessibleClasses, students, startYear])

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
        .sort((a, b) => sortClassesForDisplay(a, b, startYear)),
    [pool, grade, startYear],
  )

  const openStudent = (studentId: string) => {
    navigate(
      withScoresYearQuery(
        `/class/individual?student=${encodeURIComponent(studentId)}`,
        startYear,
        defaultStart,
      ),
    )
  }

  const openClassIndividual = (classId: string) => {
    navigate(
      withScoresYearQuery(
        `/class/individual?class=${encodeURIComponent(classId)}`,
        startYear,
        defaultStart,
      ),
    )
  }

  return (
    <div className="page class-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>班級</h1>
          <p>
            {formatAcademicYearLabel(startYear)}學年 · 並排檢視已選班級的概況。長條為每位學生學期總分（初中滿分 100：CA 20+閱40+寫40；高中滿分 100：CA 15+閱40+寫45）。點擊班級卡片可開啟該班個人頁；點擊長條可開啟該生檔案。
          </p>
          {campusDataError && (
            <p className="campus-data-notice" role="status">
              {campusDataError}
            </p>
          )}
        </div>
        <ScoresYearSelect
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={onSelectYear}
        />
      </header>

      {campusDataLoading && (
        <p className="campus-data-notice" role="status">
          正在載入 {formatAcademicYearLabel(startYear)} 學年成績…
        </p>
      )}

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
          const roster = rosterForChineseClass(
            cls.id,
            cls.name,
            students,
            startYear,
          )
            .slice()
            .sort((a, b) => a.classNumber - b.classNumber)
          const avgP = average(roster.map((s) => s.progress))
          const avgR = average(roster.map((s) => s.readingScore))
          const avgA = average(roster.map((s) => s.correctRate))
          const denseSparks = roster.length > 18
          const remedialNote = remedialClassNote(cls.name, startYear)
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
              {user?.role === 'admin' ? (
                <p className="snapshot-teacher">
                  {getTeacherNamesForClass(cls.id)}
                </p>
              ) : null}
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
                className={`spark-row${denseSparks ? ' spark-row-dense' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {roster.map((s) => {
                  const total = semesterWeightedTotal(s)
                  const semesterMax = semesterMaxForGrade(grade)
                  const heightPct = Math.max(8, (total / semesterMax) * 100)
                  return (
                  <button
                    key={s.id}
                    type="button"
                    className="spark"
                    style={{ height: `${heightPct}%` }}
                    data-tip={`${s.name}（${String(s.classNumber).padStart(2, '0')}）：總分 ${formatScore(total)}`}
                    aria-label={`開啟 ${s.name} 的個人檔案，總分 ${formatScore(total)}`}
                    onClick={() => openStudent(s.id)}
                  />
                  )
                })}
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
