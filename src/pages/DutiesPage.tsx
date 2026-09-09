import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AsyncStatus } from '../components/AsyncStatus'
import {
  DutyConfirmDialog,
  DutyEditBar,
  type DialogState,
} from '../components/duty/DutyEditControls'
import {
  EditableDeptTable,
  ItemMembers,
  MineDuties,
  PersonList,
} from '../components/duty/DeptDutyViews'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { CsvYearImportPanel } from '../components/admin/CsvYearImportPanel'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import { resolveDeptDutyTeacher } from '../data/deptDuty'
import {
  hydrateDeptDuty,
  invalidateDeptDuty,
  peekDeptDuty,
} from '../data/dutyStore'
import { useDeptDutyEditor } from '../hooks/useDeptDutyEditor'
import { useDirtyNavigationGuard } from '../hooks/useDirtyNavigationGuard'
import { applyYearCsvImport } from '../lib/adminYearImport'
import { canPreviewAllTeachers } from '../lib/permissions'
import { supabaseConfigured } from '../lib/supabase'
import { deptDutyToCsv, parseDeptDutyCsv } from '../lib/yearCsv/schemas'

type ViewMode = 'mine' | 'dept'

const ADMIN_PREVIEW_CODE = 'YLN'

function parseYearParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : fallback
}

export function DutiesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = parseYearParam(searchParams.get('year'), defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [pendingNavDiscard, setPendingNavDiscard] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)

  const {
    isAdmin,
    displayDuty,
    loading,
    editing,
    draft,
    dirty,
    saving,
    knownYears,
    enterEdit,
    exitEdit,
    patchDraftItems,
    save,
    bootstrap,
  } = useDeptDutyEditor(startYear, user)

  const { navigationBlocked, confirmNavigation, cancelNavigation } =
    useDirtyNavigationGuard(dirty && editing)

  const yearParam = searchParams.get('year')
  useEffect(() => {
    const fromUrl = parseYearParam(yearParam, defaultStart)
    setStartYear((prev) => (fromUrl !== prev ? fromUrl : prev))
  }, [yearParam, defaultStart])

  useEffect(() => {
    if (!navigationBlocked) return
    setPendingNavDiscard(true)
    setDialog({
      kind: 'confirm',
      title: '離開此頁？',
      message: '未儲存的職責修改將會遺失。',
    })
  }, [navigationBlocked])

  const academicYears = listAcademicYearStarts()
  const yearOptions = useMemo(() => {
    const base = knownYears.length ? knownYears : [startYear]
    return [...new Set([...academicYears, ...base, startYear])].sort(
      (a, b) => b - a,
    )
  }, [academicYears, knownYears, startYear])

  const ownTeacher = useMemo(
    () =>
      displayDuty ? resolveDeptDutyTeacher(user?.id, displayDuty.teachers) : null,
    [displayDuty, user?.id],
  )

  useEffect(() => {
    if (!displayDuty) return
    const fallback =
      ownTeacher?.code ??
      (canPreviewAllTeachers(user) ? ADMIN_PREVIEW_CODE : null) ??
      displayDuty.teachers[0]?.code ??
      null
    setSelectedCode(fallback)
  }, [displayDuty, ownTeacher, user, startYear])

  const activeTeacher = useMemo(
    () => displayDuty?.teachers.find((t) => t.code === selectedCode) ?? ownTeacher,
    [displayDuty, selectedCode, ownTeacher],
  )

  const showTeacherPicker =
    canPreviewAllTeachers(user) && view === 'mine' && !editing

  const syncYearToUrl = (y: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('year', String(y))
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
    setView('dept')
  }

  const onDiscard = () => {
    setPendingDeleteId(null)
    setPendingNavDiscard(false)
    if (!dirty) {
      exitEdit()
      return
    }
    setDialog({
      kind: 'confirm',
      title: '捨棄變更？',
      message: '未儲存的職責修改將會遺失。',
    })
  }

  const confirmDiscard = () => {
    setDialog(null)
    exitEdit()
    if (pendingNavDiscard) {
      setPendingNavDiscard(false)
      confirmNavigation()
    }
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
      message: `${result.duty.label} 職責分工已更新。`,
    })
  }

  const requestDelete = (itemId: number) => {
    const item = draft?.items.find((i) => i.id === itemId)
    setPendingDeleteId(itemId)
    setPendingNavDiscard(false)
    setDialog({
      kind: 'confirm',
      title: '刪除職責項目？',
      message: item ? `確定刪除「${item.title}」？` : '確定刪除此項目？',
    })
  }

  const confirmDelete = () => {
    if (pendingDeleteId == null || !draft) {
      setDialog(null)
      return
    }
    const items = draft.items
      .filter((i) => i.id !== pendingDeleteId)
      .map((item, i) => ({ ...item, id: i + 1 }))
    patchDraftItems(items)
    setPendingDeleteId(null)
    setDialog(null)
  }

  const offlineHint =
    !supabaseConfigured && !loading && displayDuty
      ? '目前未連線資料庫，顯示的是本機種子資料。'
      : null

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
    setView('dept')
    setDialog({
      kind: 'info',
      title: '已建立草稿',
      message:
        mode === 'clone'
          ? `已從 ${formatAcademicYearLabel(startYear - 1)} 複製，請檢查後按儲存寫入資料庫。`
          : '已建立空白職責框架，請填寫後按儲存寫入資料庫。',
    })
  }

  const cloneSourceExists = knownYears.includes(startYear - 1)

  return (
    <div className="page duties-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>職責</h1>
          <p>
            {view === 'mine'
              ? '查看您本學年的科組行政與非教學職掌。'
              : '中文科組內非教學事務分工總表。'}
          </p>
        </div>
        <ScoresYearSelect
          id="duties-academic-year"
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={onSelectYear}
        />
      </header>

      {isAdmin && user ? (
        <div className="reveal-up delay-1">
          <CsvYearImportPanel
            kind="dept_duty"
            startYear={startYear}
            exportCsv={
              displayDuty || peekDeptDuty(startYear)
                ? deptDutyToCsv(displayDuty ?? peekDeptDuty(startYear)!)
                : null
            }
            onParseAndImport={async ({ text }) => {
              const base = await hydrateDeptDuty(startYear)
              const parsed = parseDeptDutyCsv(text, startYear, base)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'dept_duty',
                startYear,
                userEmail: user.username,
                userId: user.id,
                dept: parsed.data,
              })
              if (result.ok) {
                invalidateDeptDuty(startYear)
                window.location.reload()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />
        </div>
      ) : null}

      {loading && !displayDuty ? (
        <AsyncStatus variant="loading" message="載入職責資料中…" />
      ) : !displayDuty ? (
        <GlassPanel className="reveal-up delay-1">
          <AsyncStatus
            variant="empty"
            panel={false}
            message={`${formatAcademicYearLabel(startYear)} 的職責分工資料尚未匯入。`}
          />
          {isAdmin ? (
            <div className="papers-bootstrap-actions">
              <button
                type="button"
                className="deadline-submit-btn"
                disabled={bootstrapping}
                onClick={() => void onBootstrap('empty')}
              >
                {bootstrapping ? '建立中…' : '建立空白職責'}
              </button>
              <button
                type="button"
                className="deadline-select-all-btn"
                disabled={bootstrapping || !cloneSourceExists}
                onClick={() => void onBootstrap('clone')}
              >
                從上學年複製
              </button>
            </div>
          ) : null}
        </GlassPanel>
      ) : (
        <>
          {offlineHint ? (
            <AsyncStatus variant="offline" message={offlineHint} panel={false} />
          ) : null}
          <GlassPanel className="papers-toolbar reveal-up delay-1">
            <div
              className="papers-view-tabs"
              role="tablist"
              aria-label="職責資料檢視"
              onKeyDown={(e) => {
                if (editing) return
                const tabs = ['mine', 'dept'] as const
                const idx = tabs.indexOf(view)
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const next =
                    e.key === 'ArrowRight'
                      ? tabs[(idx + 1) % tabs.length]
                      : tabs[(idx - 1 + tabs.length) % tabs.length]
                  setView(next)
                }
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'mine'}
                tabIndex={view === 'mine' ? 0 : -1}
                className={`papers-view-tab${view === 'mine' ? ' active' : ''}`}
                disabled={editing}
                onClick={() => setView('mine')}
              >
                我的職責
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'dept'}
                tabIndex={view === 'dept' ? 0 : -1}
                className={`papers-view-tab${view === 'dept' ? ' active' : ''}`}
                onClick={() => setView('dept')}
              >
                科組職責
              </button>
            </div>
            {isAdmin ? (
              <div className="papers-toolbar-actions">
                {editing ? (
                  <button
                    type="button"
                    className="papers-toolbar-action"
                    aria-pressed="true"
                    onClick={onDiscard}
                  >
                    結束編輯
                  </button>
                ) : (
                  <button
                    type="button"
                    className="papers-toolbar-action"
                    onClick={onEnterEdit}
                  >
                    編輯
                  </button>
                )}
              </div>
            ) : null}
          </GlassPanel>

          {editing ? (
            <DutyEditBar
              dirty={dirty}
              saving={saving}
              onSave={() => void onSave()}
              onDiscard={onDiscard}
              hint="儲存後「我的職責」會自動重算"
            />
          ) : null}

          {view === 'mine' ? (
            <GlassPanel className="papers-mine-layout reveal-up delay-2">
              {activeTeacher ? (
                <MineDuties
                  teacher={activeTeacher}
                  teachers={showTeacherPicker ? displayDuty.teachers : undefined}
                  selectedCode={selectedCode}
                  onSelectTeacher={showTeacherPicker ? setSelectedCode : undefined}
                />
              ) : (
                <AsyncStatus
                  variant="empty"
                  panel={false}
                  message="找不到與您配對的職責紀錄。"
                />
              )}
            </GlassPanel>
          ) : (
            <GlassPanel className="table-panel reveal-up delay-2">
              <div className="table-panel-head">
                <h2>科組職責一覽</h2>
                <p className="duties-source-note">
                  {displayDuty.label} · {displayDuty.items.length} 項
                </p>
              </div>
              {editing && draft ? (
                <EditableDeptTable
                  duty={draft}
                  startYear={startYear}
                  onChange={patchDraftItems}
                  onRequestDelete={requestDelete}
                />
              ) : (
                <div className="table-wrap">
                  <table className="duties-dept-table">
                    <thead>
                      <tr>
                        <th className="duties-col-num">#</th>
                        <th>項目</th>
                        <th>統籌</th>
                        <th>組員</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDuty.items.map((item) => (
                        <tr key={item.id}>
                          <td className="duties-col-num">{item.id}</td>
                          <td className="duties-item-title">{item.title}</td>
                          <td>
                            <PersonList people={item.leaders} />
                          </td>
                          <td>
                            <ItemMembers item={item} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          )}
        </>
      )}

      {dialog ? (
        <DutyConfirmDialog
          dialog={dialog}
          onClose={() => {
            setDialog(null)
            setPendingDeleteId(null)
            if (pendingNavDiscard) {
              setPendingNavDiscard(false)
              cancelNavigation()
            }
          }}
          onConfirm={() => {
            if (dialog.kind !== 'confirm') return
            if (pendingDeleteId != null) confirmDelete()
            else confirmDiscard()
          }}
        />
      ) : null}
    </div>
  )
}
