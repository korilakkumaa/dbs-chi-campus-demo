import { useEffect, useMemo, useState } from 'react'
import {
  DutyAppendixPanel,
  DutyGradeCard,
  DutyMyPanel,
  DutyTeacherDuties,
  PapersLegend,
  TeacherIdentity,
} from '../components/papers/DutyDisplay'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { SortHeader } from '../components/SortHeader'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import {
  getAssessmentDuty,
  listAssessmentDutyYears,
  workloadTierLabel,
} from '../data/assessmentDuty'
import {
  resolveDutyTeacherCode,
  teacherNameMapForYear,
} from '../data/assessmentDutyDisplay'
import type { AssessmentDutyYear } from '../data/assessmentDutyTypes'

type ViewMode = 'mine' | 'grade' | 'teacher'
type TeacherSortKey = 'name' | 'totalWeight'
type SortDir = 'asc' | 'desc'

const ADMIN_PREVIEW_CODE = 'YLN'

function gradeHasDutyData(row: AssessmentDutyYear['gradeMatrix'][number]) {
  return Object.values(row.categories).some((s) => (s?.length ?? 0) > 0)
}

function buildInitialGradeOpen(duty: AssessmentDutyYear): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  let index = 0
  for (const row of duty.gradeMatrix) {
    if (!gradeHasDutyData(row)) continue
    out[row.gradeLabel] = index < 3
    index += 1
  }
  return out
}

export function PapersPage() {
  const { user } = useAuth()
  const dutyYears = listAssessmentDutyYears()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = dutyYears.includes(defaultStart)
    ? defaultStart
    : (dutyYears[0] ?? defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [teacherSortKey, setTeacherSortKey] = useState<TeacherSortKey>('totalWeight')
  const [teacherSortDir, setTeacherSortDir] = useState<SortDir>('desc')

  const duty = getAssessmentDuty(startYear)
  const yearOptions = listAcademicYearStarts().filter((y) => dutyYears.includes(y))
  const nameMap = useMemo(() => teacherNameMapForYear(startYear), [startYear])

  const ownCode = useMemo(
    () => (duty ? resolveDutyTeacherCode(user?.id, duty.teachers) : null),
    [duty, user?.id],
  )

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [gradeOpen, setGradeOpen] = useState<Record<string, boolean>>({})
  const [appendixOpen, setAppendixOpen] = useState(false)

  useEffect(() => {
    if (!duty) return
    const fallback =
      ownCode ??
      (user?.role === 'admin' ? ADMIN_PREVIEW_CODE : null) ??
      duty.teachers[0]?.code ??
      null
    setSelectedCode(fallback)
  }, [duty, ownCode, user?.role, startYear])

  useEffect(() => {
    if (!duty || view === 'mine') return
    setGradeOpen(buildInitialGradeOpen(duty))
    setAppendixOpen(false)
  }, [duty, startYear, view])

  const visibleGradeLabels = useMemo(() => {
    if (!duty) return []
    return duty.gradeMatrix.filter(gradeHasDutyData).map((row) => row.gradeLabel)
  }, [duty])

  const allSectionsExpanded = useMemo(() => {
    const gradesExpanded =
      view !== 'grade' ||
      !visibleGradeLabels.length ||
      visibleGradeLabels.every((label) => gradeOpen[label])
    const appendixExpanded = !duty?.ecAppendix.length || appendixOpen
    return gradesExpanded && appendixExpanded
  }, [view, visibleGradeLabels, gradeOpen, duty?.ecAppendix.length, appendixOpen])

  const toggleAllSections = () => {
    const next = !allSectionsExpanded
    if (view === 'grade') {
      setGradeOpen((prev) => {
        const out = { ...prev }
        for (const label of visibleGradeLabels) out[label] = next
        return out
      })
    }
    if (duty?.ecAppendix.length) setAppendixOpen(next)
  }

  const showCollapseToggle =
    view !== 'mine' &&
    (view === 'grade' ? visibleGradeLabels.length > 0 : Boolean(duty?.ecAppendix.length))

  const activeTeacher = useMemo(
    () => duty?.teachers.find((t) => t.code === selectedCode) ?? null,
    [duty, selectedCode],
  )

  const sortedTeachers = useMemo(() => {
    if (!duty) return []
    const rows = [...duty.teachers]
    const factor = teacherSortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (teacherSortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'zh-Hant')
      } else {
        const aw = a.totalWeight ?? -1
        const bw = b.totalWeight ?? -1
        cmp = aw - bw
        if (cmp === 0) cmp = a.name.localeCompare(b.name, 'zh-Hant')
      }
      return cmp * factor
    })
    return rows
  }, [duty, teacherSortKey, teacherSortDir])

  const onTeacherSort = (key: TeacherSortKey, nextDir: SortDir) => {
    setTeacherSortKey(key)
    setTeacherSortDir(nextDir)
  }

  const showTeacherPicker = user?.role === 'admin' && view === 'mine'

  return (
    <div className="page papers-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>出卷</h1>
          <p>
            {view === 'mine'
              ? '查看您負責的考核卷別與學年權重。'
              : '各級考核擬題分工與教師工作量。'}
          </p>
        </div>
        <ScoresYearSelect
          id="papers-academic-year"
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions.length ? yearOptions : dutyYears}
          onSelectYear={setStartYear}
        />
      </header>

      {!duty ? (
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">
            {formatAcademicYearLabel(startYear)} 的出卷分工資料尚未匯入。
          </p>
        </GlassPanel>
      ) : (
        <>
          <GlassPanel className="papers-toolbar reveal-up delay-1">
            <div className="papers-view-tabs" role="tablist" aria-label="出卷資料檢視">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'mine'}
                className={`papers-view-tab${view === 'mine' ? ' active' : ''}`}
                onClick={() => setView('mine')}
              >
                我的出卷
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'grade'}
                className={`papers-view-tab${view === 'grade' ? ' active' : ''}`}
                onClick={() => setView('grade')}
              >
                按年級查
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'teacher'}
                className={`papers-view-tab${view === 'teacher' ? ' active' : ''}`}
                onClick={() => setView('teacher')}
              >
                按教師查
              </button>
            </div>
            <div className="papers-toolbar-actions">
              {showCollapseToggle ? (
                <button
                  type="button"
                  className="papers-toolbar-action"
                  onClick={toggleAllSections}
                  aria-pressed={allSectionsExpanded}
                >
                  {allSectionsExpanded ? '全部折疊' : '全部展開'}
                </button>
              ) : null}
              <PapersLegend />
            </div>
          </GlassPanel>

          {view === 'mine' ? (
            <GlassPanel className="papers-mine-layout reveal-up delay-2">
              {activeTeacher ? (
                <DutyMyPanel
                  teacher={activeTeacher}
                  duty={duty}
                  nameMap={nameMap}
                  teachers={showTeacherPicker ? duty.teachers : undefined}
                  selectedCode={selectedCode}
                  onSelectTeacher={showTeacherPicker ? setSelectedCode : undefined}
                />
              ) : (
                <p className="empty-note">無法載入出卷分工，請聯絡管理員。</p>
              )}
            </GlassPanel>
          ) : view === 'grade' ? (
            <div className="papers-grade-cards reveal-up delay-2">
              {duty.gradeMatrix.map((row) => {
                if (!gradeHasDutyData(row)) return null

                return (
                  <GlassPanel key={row.gradeLabel} className="papers-grade-card">
                    <DutyGradeCard
                      gradeRow={row}
                      nameMap={nameMap}
                      open={gradeOpen[row.gradeLabel] ?? false}
                      onOpenChange={(next) =>
                        setGradeOpen((prev) => ({ ...prev, [row.gradeLabel]: next }))
                      }
                    />
                  </GlassPanel>
                )
              })}
            </div>
          ) : (
            <GlassPanel className="table-panel reveal-up delay-2">
              <div className="table-panel-head">
                <h2>教師分工一覽</h2>
                <p className="papers-weight-legend">
                  權重：
                  <span className="duty-tier high">≥3.0</span>
                  <span className="duty-tier medium">≥2.5</span>
                  <span className="duty-tier moderate">≥2.0</span>
                  <span className="duty-tier low">&lt;2.0</span>
                </p>
              </div>
              <div className="table-wrap">
                <table className="papers-teacher-table">
                  <thead>
                    <tr>
                      <SortHeader
                        label="教師"
                        column="name"
                        activeKey={teacherSortKey}
                        dir={teacherSortDir}
                        onSort={onTeacherSort}
                      />
                      <th>上學期分工</th>
                      <th>下學期分工</th>
                      <SortHeader
                        label="學年權重"
                        column="totalWeight"
                        activeKey={teacherSortKey}
                        dir={teacherSortDir}
                        onSort={onTeacherSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeachers.map((t) => (
                      <tr key={t.code || t.name}>
                        <td>
                          <TeacherIdentity code={t.code} nameMap={nameMap} />
                        </td>
                        <td>
                          <DutyTeacherDuties items={t.firstSemester} />
                        </td>
                        <td>
                          <DutyTeacherDuties items={t.secondSemester} />
                        </td>
                        <td>
                          {t.totalWeight != null ? (
                            <span
                              className={`duty-weight duty-tier ${t.workloadTier}`}
                              title={workloadTierLabel(t.workloadTier)}
                            >
                              {t.totalWeight}
                            </span>
                          ) : (
                            <span className="duty-empty">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          )}

          {view !== 'mine' && duty.ecAppendix.length > 0 ? (
            <GlassPanel className="papers-appendix reveal-up delay-3">
              <DutyAppendixPanel
                rows={duty.ecAppendix}
                nameMap={nameMap}
                open={appendixOpen}
                onOpenChange={setAppendixOpen}
              />
            </GlassPanel>
          ) : null}
        </>
      )}
    </div>
  )
}
