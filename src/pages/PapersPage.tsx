import { useEffect, useMemo, useState } from 'react'
import {
  DutyConfirmDialog,
  DutyEditBar,
  type DialogState,
} from '../components/duty/DutyEditControls'
import { GlassPanel } from '../components/GlassPanel'
import {
  DutyAppendixPanel,
  DutyGradeCard,
  DutyMyPanel,
  DutyTeacherDuties,
  PapersLegend,
  TeacherIdentity,
} from '../components/papers/DutyDisplay'
import { EditableEcAppendix, EditableGradeMatrix } from '../components/papers/PapersEdit'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { SortHeader } from '../components/SortHeader'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import {
  listAssessmentDutyYears,
  workloadTierLabel,
} from '../data/assessmentDuty'
import { withDerivedAssessmentTeachers } from '../data/assessmentDutyDerive'
import {
  resolveDutyTeacherCode,
  teacherNameMapForYear,
} from '../data/assessmentDutyDisplay'
import type { AssessmentDutyYear, GradeDutyRow } from '../data/assessmentDutyTypes'
import type { EcAppendixRow } from '../data/assessmentDutyParse'
import {
  canMutateDuty,
  hydrateAssessmentDuty,
  listHydratedAssessmentYears,
  peekAssessmentDuty,
  saveAssessmentDuty,
} from '../data/dutyStore'

type ViewMode = 'mine' | 'grade' | 'teacher'
type TeacherSortKey = 'name' | 'totalWeight'
type SortDir = 'asc' | 'desc'

const ADMIN_PREVIEW_CODE = 'YLN'

function cloneDuty(duty: AssessmentDutyYear): AssessmentDutyYear {
  return structuredClone(duty)
}

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
  const isAdmin = canMutateDuty(user)
  const seedYears = listAssessmentDutyYears()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = seedYears.includes(defaultStart)
    ? defaultStart
    : (seedYears[0] ?? defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [teacherSortKey, setTeacherSortKey] = useState<TeacherSortKey>('totalWeight')
  const [teacherSortDir, setTeacherSortDir] = useState<SortDir>('desc')
  const [duty, setDuty] = useState<AssessmentDutyYear | null>(() =>
    peekAssessmentDuty(initialYear),
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AssessmentDutyYear | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDeleteGrade, setPendingDeleteGrade] = useState<string | null>(null)

  const dutyYears = listHydratedAssessmentYears()
  const yearOptions = listAcademicYearStarts().filter((y) => dutyYears.includes(y))
  const nameMap = useMemo(() => teacherNameMapForYear(startYear), [startYear])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setDraft(null)
    setDirty(false)
    void hydrateAssessmentDuty(startYear).then((next) => {
      if (cancelled) return
      setDuty(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startYear])

  const displayDuty = editing && draft ? draft : duty

  const ownCode = useMemo(
    () =>
      displayDuty ? resolveDutyTeacherCode(user?.id, displayDuty.teachers) : null,
    [displayDuty, user?.id],
  )

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [gradeOpen, setGradeOpen] = useState<Record<string, boolean>>({})
  const [appendixOpen, setAppendixOpen] = useState(false)

  useEffect(() => {
    if (!displayDuty) return
    const fallback =
      ownCode ??
      (user?.role === 'admin' ? ADMIN_PREVIEW_CODE : null) ??
      displayDuty.teachers[0]?.code ??
      null
    setSelectedCode(fallback)
  }, [displayDuty, ownCode, user?.role, startYear])

  useEffect(() => {
    if (!displayDuty || view === 'mine' || editing) return
    setGradeOpen(buildInitialGradeOpen(displayDuty))
    setAppendixOpen(false)
  }, [displayDuty, startYear, view, editing])

  const visibleGradeLabels = useMemo(() => {
    if (!displayDuty) return []
    return displayDuty.gradeMatrix.filter(gradeHasDutyData).map((row) => row.gradeLabel)
  }, [displayDuty])

  const allSectionsExpanded = useMemo(() => {
    const gradesExpanded =
      view !== 'grade' ||
      !visibleGradeLabels.length ||
      visibleGradeLabels.every((label) => gradeOpen[label])
    const appendixExpanded = !displayDuty?.ecAppendix.length || appendixOpen
    return gradesExpanded && appendixExpanded
  }, [view, visibleGradeLabels, gradeOpen, displayDuty?.ecAppendix.length, appendixOpen])

  const toggleAllSections = () => {
    const next = !allSectionsExpanded
    if (view === 'grade') {
      setGradeOpen((prev) => {
        const out = { ...prev }
        for (const label of visibleGradeLabels) out[label] = next
        return out
      })
    }
    if (displayDuty?.ecAppendix.length) setAppendixOpen(next)
  }

  const showCollapseToggle =
    !editing &&
    view !== 'mine' &&
    (view === 'grade' ? visibleGradeLabels.length > 0 : Boolean(displayDuty?.ecAppendix.length))

  const activeTeacher = useMemo(
    () => displayDuty?.teachers.find((t) => t.code === selectedCode) ?? null,
    [displayDuty, selectedCode],
  )

  const sortedTeachers = useMemo(() => {
    if (!displayDuty) return []
    const rows = [...displayDuty.teachers]
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
  }, [displayDuty, teacherSortKey, teacherSortDir])

  const onTeacherSort = (key: TeacherSortKey, nextDir: SortDir) => {
    setTeacherSortKey(key)
    setTeacherSortDir(nextDir)
  }

  const showTeacherPicker = user?.role === 'admin' && view === 'mine' && !editing

  const enterEdit = () => {
    if (!duty || !isAdmin) return
    setView('grade')
    setDraft(cloneDuty(duty))
    setEditing(true)
    setDirty(false)
  }

  const exitEdit = () => {
    setEditing(false)
    setDraft(null)
    setDirty(false)
  }

  const patchDraft = (
    patch: Partial<Pick<AssessmentDutyYear, 'gradeMatrix' | 'ecAppendix'>>,
  ) => {
    if (!draft) return
    setDraft(
      withDerivedAssessmentTeachers({
        ...draft,
        ...patch,
      }),
    )
    setDirty(true)
  }

  const onDiscard = () => {
    setPendingDeleteGrade(null)
    if (!dirty) {
      exitEdit()
      return
    }
    setDialog({
      kind: 'confirm',
      title: '捨棄變更？',
      message: '未儲存的出卷修改將會遺失。',
    })
  }

  const confirmDiscard = () => {
    setDialog(null)
    exitEdit()
  }

  const onSave = async () => {
    if (!draft || !user) return
    setSaving(true)
    const result = await saveAssessmentDuty(draft, user)
    setSaving(false)
    if (!result.ok || !result.duty) {
      setDialog({
        kind: 'info',
        title: '儲存失敗',
        message: result.error ?? '無法寫入 Supabase。',
      })
      return
    }
    setDuty(result.duty)
    setDirty(false)
    setDraft(cloneDuty(result.duty))
    setDialog({
      kind: 'info',
      title: '已儲存',
      message: `${result.duty.label} 出卷分工已更新，教師工作量已重算。`,
    })
  }

  const requestDeleteGrade = (gradeLabel: string) => {
    setPendingDeleteGrade(gradeLabel)
    setDialog({
      kind: 'confirm',
      title: '刪除年級列？',
      message: `確定刪除「${gradeLabel}」及其所有出卷格子？`,
    })
  }

  const confirmDeleteGrade = () => {
    if (!pendingDeleteGrade || !draft) {
      setDialog(null)
      return
    }
    patchDraft({
      gradeMatrix: draft.gradeMatrix.filter((r) => r.gradeLabel !== pendingDeleteGrade),
    })
    setPendingDeleteGrade(null)
    setDialog(null)
  }

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
          onSelectYear={(y) => {
            if (editing && dirty) {
              setDialog({
                kind: 'info',
                title: '請先結束編輯',
                message: '切換學年前請先儲存或捨棄變更。',
              })
              return
            }
            if (editing) exitEdit()
            setStartYear(y)
          }}
        />
      </header>

      {loading && !displayDuty ? (
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">載入出卷資料中…</p>
        </GlassPanel>
      ) : !displayDuty ? (
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
                disabled={editing}
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
                disabled={editing}
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
              {isAdmin ? (
                editing ? (
                  <button
                    type="button"
                    className="papers-toolbar-action"
                    aria-pressed="true"
                    onClick={onDiscard}
                  >
                    結束編輯
                  </button>
                ) : (
                  <button type="button" className="papers-toolbar-action" onClick={enterEdit}>
                    編輯
                  </button>
                )
              ) : null}
              <PapersLegend />
            </div>
          </GlassPanel>

          {editing ? (
            <DutyEditBar
              dirty={dirty}
              saving={saving}
              onSave={() => void onSave()}
              onDiscard={onDiscard}
              hint="儲存後會重算各教師學年權重"
            />
          ) : null}

          {editing && draft ? (
            <>
              <GlassPanel className="table-panel reveal-up delay-2">
                <div className="table-panel-head">
                  <h2>編輯年級矩陣</h2>
                  <p className="duties-source-note">{draft.label}</p>
                </div>
                <EditableGradeMatrix
                  duty={draft}
                  startYear={startYear}
                  nameMap={nameMap}
                  onChange={(gradeMatrix: GradeDutyRow[]) => patchDraft({ gradeMatrix })}
                  onRequestDeleteGrade={requestDeleteGrade}
                />
              </GlassPanel>
              <GlassPanel className="papers-appendix reveal-up delay-3">
                <div className="table-panel-head">
                  <h2>編輯 EC 附錄</h2>
                </div>
                <EditableEcAppendix
                  rows={draft.ecAppendix}
                  startYear={startYear}
                  nameMap={nameMap}
                  onChange={(ecAppendix: EcAppendixRow[]) => patchDraft({ ecAppendix })}
                />
              </GlassPanel>
            </>
          ) : view === 'mine' ? (
            <GlassPanel className="papers-mine-layout reveal-up delay-2">
              {activeTeacher ? (
                <DutyMyPanel
                  teacher={activeTeacher}
                  duty={displayDuty}
                  nameMap={nameMap}
                  teachers={showTeacherPicker ? displayDuty.teachers : undefined}
                  selectedCode={selectedCode}
                  onSelectTeacher={showTeacherPicker ? setSelectedCode : undefined}
                />
              ) : (
                <p className="empty-note">無法載入出卷分工，請聯絡管理員。</p>
              )}
            </GlassPanel>
          ) : view === 'grade' ? (
            <div className="papers-grade-cards reveal-up delay-2">
              {displayDuty.gradeMatrix.map((row) => {
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

          {!editing && view !== 'mine' && displayDuty.ecAppendix.length > 0 ? (
            <GlassPanel className="papers-appendix reveal-up delay-3">
              <DutyAppendixPanel
                rows={displayDuty.ecAppendix}
                nameMap={nameMap}
                open={appendixOpen}
                onOpenChange={setAppendixOpen}
              />
            </GlassPanel>
          ) : null}
        </>
      )}

      {dialog ? (
        <DutyConfirmDialog
          dialog={dialog}
          onClose={() => {
            setDialog(null)
            setPendingDeleteGrade(null)
          }}
          onConfirm={() => {
            if (dialog.kind !== 'confirm') return
            if (pendingDeleteGrade != null) confirmDeleteGrade()
            else confirmDiscard()
          }}
        />
      ) : null}
    </div>
  )
}
