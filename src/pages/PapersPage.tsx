import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { workloadTierLabel } from '../data/assessmentDuty'
import {
  resolveDutyTeacherCode,
  teacherNameMapForYear,
} from '../data/assessmentDutyDisplay'
import type { GradeDutyRow } from '../data/assessmentDutyTypes'
import type { EcAppendixRow } from '../data/assessmentDutyParse'
import { peekAssessmentDuty } from '../data/dutyStore'
import { useAssessmentDutyEditor } from '../hooks/useAssessmentDutyEditor'

type ViewMode = 'mine' | 'grade' | 'teacher'
type TeacherSortKey = 'name' | 'totalWeight'
type SortDir = 'asc' | 'desc'

const ADMIN_PREVIEW_CODE = 'YLN'

function gradeHasDutyData(row: { categories: Record<string, unknown[] | undefined> }) {
  return Object.values(row.categories).some((s) => (s?.length ?? 0) > 0)
}

function buildInitialGradeOpen(
  duty: { gradeMatrix: { gradeLabel: string; categories: Record<string, unknown[] | undefined> }[] },
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  let index = 0
  for (const row of duty.gradeMatrix) {
    if (!gradeHasDutyData(row)) continue
    out[row.gradeLabel] = index < 3
    index += 1
  }
  return out
}

function parseYearParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : fallback
}

export function PapersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = parseYearParam(searchParams.get('year'), defaultStart)
  const wantEdit = searchParams.get('edit') === '1'

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [teacherSortKey, setTeacherSortKey] = useState<TeacherSortKey>('totalWeight')
  const [teacherSortDir, setTeacherSortDir] = useState<SortDir>('desc')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDeleteGrade, setPendingDeleteGrade] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)

  const {
    isAdmin,
    duty,
    displayDuty,
    loading,
    editing,
    draft,
    dirty,
    saving,
    knownYears,
    enterEdit,
    exitEdit,
    patchDraft,
    bootstrap,
    save,
  } = useAssessmentDutyEditor(startYear, user)

  const academicYears = listAcademicYearStarts()
  const yearOptions = useMemo(() => {
    if (isAdmin) {
      return [...new Set([...academicYears, ...knownYears, startYear])].sort(
        (a, b) => b - a,
      )
    }
    const base = knownYears.length ? knownYears : [startYear]
    return [...new Set([...base, startYear])].sort((a, b) => b - a)
  }, [academicYears, knownYears, startYear, isAdmin])

  const nameMap = useMemo(() => teacherNameMapForYear(startYear), [startYear])
  const yearParam = searchParams.get('year')

  // Sync URL → year when landing with ?year=
  useEffect(() => {
    const fromUrl = parseYearParam(yearParam, defaultStart)
    setStartYear((prev) => (fromUrl !== prev ? fromUrl : prev))
  }, [yearParam, defaultStart])

  // Auto-enter edit once when ?edit=1 and duty is ready; clear flag after load.
  useEffect(() => {
    if (!wantEdit || loading) return
    if (!isAdmin) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
      return
    }
    if (editing) return
    if (duty) {
      enterEdit(duty)
      setView('grade')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [
    wantEdit,
    isAdmin,
    loading,
    duty,
    editing,
    enterEdit,
    searchParams,
    setSearchParams,
  ])

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
    if (!displayDuty || view === 'mine') return
    if (editing) {
      setAppendixOpen(false)
      return
    }
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

  const syncYearToUrl = (y: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('year', String(y))
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }

  const onSelectYear = (y: number) => {
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
    syncYearToUrl(y)
  }

  const onEnterEdit = () => {
    if (!enterEdit()) return
    setView('grade')
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
    const result = await save()
    if (!result.ok) {
      setDialog({
        kind: 'info',
        title: '儲存失敗',
        message: result.error ?? '無法寫入 Supabase。',
      })
      return
    }
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

  const onBootstrap = async (mode: 'empty' | 'clone') => {
    setBootstrapping(true)
    const cloneFrom = mode === 'clone' ? startYear - 1 : undefined
    const result = await bootstrap(mode, cloneFrom)
    setBootstrapping(false)
    if (!result.ok) {
      setDialog({
        kind: 'info',
        title: '無法建立',
        message: result.error,
      })
      return
    }
    setView('grade')
    setDialog({
      kind: 'info',
      title: '已建立草稿',
      message:
        mode === 'clone'
          ? `已從 ${formatAcademicYearLabel(startYear - 1)} 複製，請檢查後按儲存寫入資料庫。`
          : '已建立空白出卷框架，請填寫後按儲存寫入資料庫。',
    })
  }

  const cloneSourceExists =
    knownYears.includes(startYear - 1) || Boolean(peekAssessmentDuty(startYear - 1))

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
          yearOptions={yearOptions.length ? yearOptions : [startYear]}
          onSelectYear={onSelectYear}
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
          {isAdmin ? (
            <div className="papers-bootstrap-actions">
              <button
                type="button"
                className="deadline-submit-btn"
                disabled={bootstrapping}
                onClick={() => void onBootstrap('empty')}
              >
                {bootstrapping ? '建立中…' : '建立空白出卷'}
              </button>
              <button
                type="button"
                className="deadline-select-all-btn"
                disabled={bootstrapping || !cloneSourceExists}
                onClick={() => void onBootstrap('clone')}
                title={
                  cloneSourceExists
                    ? `從 ${formatAcademicYearLabel(startYear - 1)} 複製`
                    : '沒有可複製的上學年資料'
                }
              >
                從上學年複製
              </button>
            </div>
          ) : null}
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
                  <button type="button" className="papers-toolbar-action" onClick={onEnterEdit}>
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
              hint="儲存後會重算各教師學年權重，並寫入 Supabase"
            />
          ) : null}

          {editing && draft ? (
            <>
              <GlassPanel className="table-panel reveal-up delay-2">
                <div className="table-panel-head">
                  <h2>編輯年級矩陣</h2>
                  <p className="duties-source-note">
                    {draft.label} · 點年級可專注編輯其餘會折疊
                  </p>
                </div>
                <EditableGradeMatrix
                  duty={draft}
                  nameMap={nameMap}
                  onChange={(gradeMatrix: GradeDutyRow[]) => patchDraft({ gradeMatrix })}
                  onRequestDeleteGrade={requestDeleteGrade}
                />
              </GlassPanel>
              <GlassPanel className="papers-appendix reveal-up delay-3">
                <details
                  className="papers-appendix-details papers-appendix-edit-details"
                  open={appendixOpen}
                  onToggle={(event) => setAppendixOpen(event.currentTarget.open)}
                >
                  <summary className="papers-appendix-head">
                    <span className="papers-grade-chevron" aria-hidden="true" />
                    <h2>編輯 EC 附錄</h2>
                    <span className="papers-grade-edit-meta">
                      {draft.ecAppendix.length
                        ? `${draft.ecAppendix.length} 列`
                        : '尚無列'}
                    </span>
                  </summary>
                  <div className="papers-appendix-body">
                    <EditableEcAppendix
                      rows={draft.ecAppendix}
                      nameMap={nameMap}
                      onChange={(ecAppendix: EcAppendixRow[]) =>
                        patchDraft({ ecAppendix })
                      }
                    />
                  </div>
                </details>
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
