import { useEffect, useMemo, useState } from 'react'
import {
  DutyConfirmDialog,
  DutyEditBar,
  TeacherCodeSelect,
  teacherSelectOptions,
  type DialogState,
} from '../components/duty/DutyEditControls'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import {
  deptDutyNameMap,
  listDeptDutyYears,
  resolveDeptDutyTeacher,
  roleLabel,
  sortTeacherDutyLines,
} from '../data/deptDuty'
import { withDerivedDeptTeachers } from '../data/deptDutyDerive'
import type {
  DeptDutyItem,
  DeptDutyMemberGroup,
  DeptDutyPerson,
  DeptDutyYear,
  TeacherDeptDuty,
} from '../data/deptDutyTypes'
import {
  canMutateDuty,
  hydrateDeptDuty,
  listHydratedDeptYears,
  peekDeptDuty,
  saveDeptDuty,
} from '../data/dutyStore'
import { teacherWhitelistForYear } from '../data/teacherWhitelist'

type ViewMode = 'mine' | 'dept'
type MemberMode = 'list' | 'all' | 'groups'

const ADMIN_PREVIEW_CODE = 'YLN'

function cloneDuty(duty: DeptDutyYear): DeptDutyYear {
  return structuredClone(duty)
}

function memberModeOf(item: DeptDutyItem): MemberMode {
  if (item.membersAll) return 'all'
  if (item.memberGroups?.length) return 'groups'
  return 'list'
}

function PersonChip({ person }: { person: DeptDutyPerson }) {
  return (
    <span className="duties-person">
      <span className="duties-person-name">{person.name}</span>
      <span className="duties-person-code">{person.code}</span>
      {person.note ? <span className="duties-person-note">{person.note}</span> : null}
    </span>
  )
}

function PersonList({ people }: { people: DeptDutyPerson[] }) {
  if (!people.length) return <span className="duty-empty">—</span>
  return (
    <ul className="duties-person-list">
      {people.map((p) => (
        <li key={`${p.code}-${p.note ?? ''}`}>
          <PersonChip person={p} />
        </li>
      ))}
    </ul>
  )
}

function ItemMembers({ item }: { item: DeptDutyItem }) {
  if (item.membersAll) return <span className="duties-all">全組</span>
  if (item.memberGroups?.length) {
    return (
      <div className="duties-member-groups">
        {item.memberGroups.map((group) => (
          <div key={group.label} className="duties-member-group">
            <p className="duties-member-group-label">{group.label}</p>
            <PersonList people={group.people} />
          </div>
        ))}
      </div>
    )
  }
  return <PersonList people={item.members} />
}

function TeacherPicker({
  teachers,
  selectedCode,
  onSelect,
}: {
  teachers: TeacherDeptDuty[]
  selectedCode: string | null
  onSelect: (code: string) => void
}) {
  const sorted = [...teachers].sort((a, b) => a.code.localeCompare(b.code, 'en'))
  return (
    <aside className="papers-teacher-picker papers-teacher-picker-bar" aria-label="選擇老師">
      <p className="papers-teacher-picker-label">老師</p>
      <div className="papers-teacher-picker-list" role="listbox">
        {sorted.map((t) => (
          <button
            key={t.code}
            type="button"
            role="option"
            aria-selected={selectedCode === t.code}
            className={`papers-teacher-picker-btn${selectedCode === t.code ? ' active' : ''}`}
            title={`${t.name}（${t.code}）`}
            onClick={() => onSelect(t.code)}
          >
            {t.code}
          </button>
        ))}
      </div>
      <p className="papers-teacher-picker-hint">管理員可點選代碼預覽各老師職責</p>
    </aside>
  )
}

function MineDuties({
  teacher,
  teachers,
  selectedCode,
  onSelectTeacher,
}: {
  teacher: TeacherDeptDuty
  teachers?: TeacherDeptDuty[]
  selectedCode?: string | null
  onSelectTeacher?: (code: string) => void
}) {
  const showPicker = teachers != null && onSelectTeacher != null
  const lines = sortTeacherDutyLines(teacher.lines)
  return (
    <div className="papers-mine-panel">
      <header className="papers-mine-head">
        <div className="papers-mine-identity">
          <h2>{teacher.name}</h2>
          <p className="papers-mine-code">
            {teacher.code}
            {teacher.title ? ` · ${teacher.title}` : ''}
          </p>
        </div>
        <span className="duties-count">{lines.length} 項</span>
      </header>
      {showPicker ? (
        <TeacherPicker
          teachers={teachers}
          selectedCode={selectedCode ?? teacher.code}
          onSelect={onSelectTeacher}
        />
      ) : null}
      {lines.length === 0 ? (
        <p className="papers-mine-empty">本學年無科組職責紀錄</p>
      ) : (
        <ol className="duties-mine-list">
          {lines.map((line) => {
            const role = roleLabel(line.role)
            return (
              <li key={`${line.itemId}-${line.note ?? ''}`} className="duties-mine-item">
                <span className="duties-mine-num">{line.itemId}</span>
                <div className="duties-mine-body">
                  <p className="duties-mine-title">{line.title}</p>
                  {line.note ? <p className="duties-mine-note">{line.note}</p> : null}
                </div>
                {role ? (
                  <span className={`duties-role duties-role-${line.role}`}>{role}</span>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function PersonEditor({
  people,
  options,
  startYear,
  onChange,
}: {
  people: DeptDutyPerson[]
  options: { code: string; name: string }[]
  startYear: number
  onChange: (next: DeptDutyPerson[]) => void
}) {
  const nameMap = useMemo(() => new Map(options.map((o) => [o.code, o.name])), [options])

  const updateAt = (idx: number, patch: Partial<DeptDutyPerson>) => {
    onChange(
      people.map((p, i) => {
        if (i !== idx) return p
        const next = { ...p, ...patch }
        if (patch.code) next.name = nameMap.get(patch.code) ?? patch.code
        return next
      }),
    )
  }

  return (
    <div className="duty-person-editor">
      {people.map((p, idx) => (
        <div key={`${p.code}-${idx}`} className="duty-person-editor-row">
          <TeacherCodeSelect
            startYear={startYear}
            value={p.code}
            options={options}
            onChange={(code) => updateAt(idx, { code })}
          />
          <input
            className="duty-note-input"
            placeholder="備註（選填）"
            value={p.note ?? ''}
            onChange={(e) =>
              updateAt(idx, { note: e.target.value.trim() ? e.target.value : undefined })
            }
          />
          <button
            type="button"
            className="duty-icon-btn"
            aria-label="移除"
            onClick={() => onChange(people.filter((_, i) => i !== idx))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="duty-add-btn"
        onClick={() => {
          const fallback = options[0]
          if (!fallback) return
          onChange([...people, { code: fallback.code, name: fallback.name }])
        }}
      >
        ＋ 加入
      </button>
    </div>
  )
}

function MemberGroupsEditor({
  groups,
  options,
  startYear,
  onChange,
}: {
  groups: DeptDutyMemberGroup[]
  options: { code: string; name: string }[]
  startYear: number
  onChange: (next: DeptDutyMemberGroup[]) => void
}) {
  return (
    <div className="duty-groups-editor">
      {groups.map((group, gIdx) => (
        <div key={gIdx} className="duty-group-block">
          <div className="duty-group-head">
            <input
              className="duty-text-input"
              value={group.label}
              placeholder="分組名稱"
              onChange={(e) => {
                const next = groups.map((g, i) =>
                  i === gIdx ? { ...g, label: e.target.value } : g,
                )
                onChange(next)
              }}
            />
            <button
              type="button"
              className="duty-icon-btn"
              aria-label="刪除分組"
              onClick={() => onChange(groups.filter((_, i) => i !== gIdx))}
            >
              ×
            </button>
          </div>
          <PersonEditor
            people={group.people}
            options={options}
            startYear={startYear}
            onChange={(people) => {
              const next = groups.map((g, i) => (i === gIdx ? { ...g, people } : g))
              onChange(next)
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="duty-add-btn"
        onClick={() => onChange([...groups, { label: '新分組', people: [] }])}
      >
        ＋ 新增分組
      </button>
    </div>
  )
}

function EditableDeptTable({
  duty,
  startYear,
  onChange,
  onRequestDelete,
}: {
  duty: DeptDutyYear
  startYear: number
  onChange: (items: DeptDutyItem[]) => void
  onRequestDelete: (itemId: number) => void
}) {
  const nameMap = deptDutyNameMap(duty, startYear)
  for (const t of teacherWhitelistForYear(startYear)) {
    nameMap.set(t.initial, t.name)
  }
  const options = teacherSelectOptions(startYear, nameMap)

  const updateItem = (id: number, patch: Partial<DeptDutyItem>) => {
    onChange(duty.items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const setMemberMode = (item: DeptDutyItem, mode: MemberMode) => {
    if (mode === 'all') {
      updateItem(item.id, { membersAll: true, members: [], memberGroups: undefined })
    } else if (mode === 'groups') {
      updateItem(item.id, {
        membersAll: false,
        members: [],
        memberGroups: item.memberGroups?.length
          ? item.memberGroups
          : [{ label: '組員', people: [...item.members] }],
      })
    } else {
      const fromGroups =
        item.memberGroups?.flatMap((g) => g.people) ?? item.members ?? []
      updateItem(item.id, {
        membersAll: false,
        memberGroups: undefined,
        members: fromGroups,
      })
    }
  }

  const addItem = () => {
    const nextId = duty.items.reduce((m, i) => Math.max(m, i.id), 0) + 1
    onChange([
      ...duty.items,
      { id: nextId, title: '新職責項目', leaders: [], members: [] },
    ])
  }

  const moveItem = (id: number, dir: -1 | 1) => {
    const idx = duty.items.findIndex((i) => i.id === id)
    const swap = idx + dir
    if (idx < 0 || swap < 0 || swap >= duty.items.length) return
    const next = [...duty.items]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next.map((item, i) => ({ ...item, id: i + 1 })))
  }

  return (
    <div className="table-wrap">
      <table className="duties-dept-table duties-dept-table-edit">
        <thead>
          <tr>
            <th className="duties-col-num">#</th>
            <th>項目</th>
            <th>統籌</th>
            <th>組員</th>
            <th className="duties-col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {duty.items.map((item) => {
            const mode = memberModeOf(item)
            return (
              <tr key={item.id}>
                <td className="duties-col-num">{item.id}</td>
                <td>
                  <input
                    className="duty-text-input duty-title-input"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  />
                </td>
                <td>
                  <PersonEditor
                    people={item.leaders}
                    options={options}
                    startYear={startYear}
                    onChange={(leaders) => updateItem(item.id, { leaders })}
                  />
                </td>
                <td>
                  <div className="duty-member-mode" role="group" aria-label="組員模式">
                    {(
                      [
                        ['list', '名單'],
                        ['all', '全組'],
                        ['groups', '分組'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`duty-mode-chip${mode === value ? ' active' : ''}`}
                        onClick={() => setMemberMode(item, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {mode === 'all' ? (
                    <span className="duties-all">全組</span>
                  ) : mode === 'groups' ? (
                    <MemberGroupsEditor
                      groups={item.memberGroups ?? []}
                      options={options}
                      startYear={startYear}
                      onChange={(memberGroups) => updateItem(item.id, { memberGroups })}
                    />
                  ) : (
                    <PersonEditor
                      people={item.members}
                      options={options}
                      startYear={startYear}
                      onChange={(members) => updateItem(item.id, { members })}
                    />
                  )}
                </td>
                <td className="duties-col-actions">
                  <div className="duty-row-actions">
                    <button
                      type="button"
                      className="duty-icon-btn"
                      aria-label="上移"
                      onClick={() => moveItem(item.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="duty-icon-btn"
                      aria-label="下移"
                      onClick={() => moveItem(item.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="duty-icon-btn danger"
                      aria-label="刪除項目"
                      onClick={() => onRequestDelete(item.id)}
                    >
                      刪
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="duty-add-item-btn" onClick={addItem}>
        ＋ 新增職責項目
      </button>
    </div>
  )
}

export function DutiesPage() {
  const { user } = useAuth()
  const isAdmin = canMutateDuty(user)
  const seedYears = listDeptDutyYears()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = seedYears.includes(defaultStart)
    ? defaultStart
    : (seedYears[0] ?? defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [duty, setDuty] = useState<DeptDutyYear | null>(() => peekDeptDuty(initialYear))
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DeptDutyYear | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const dutyYears = listHydratedDeptYears()
  const yearOptions = listAcademicYearStarts().filter((y) => dutyYears.includes(y))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setDraft(null)
    setDirty(false)
    void hydrateDeptDuty(startYear).then((next) => {
      if (cancelled) return
      setDuty(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startYear])

  const displayDuty = editing && draft ? draft : duty

  const ownTeacher = useMemo(
    () =>
      displayDuty ? resolveDeptDutyTeacher(user?.id, displayDuty.teachers) : null,
    [displayDuty, user?.id],
  )

  useEffect(() => {
    if (!displayDuty) return
    const fallback =
      ownTeacher?.code ??
      (user?.role === 'admin' ? ADMIN_PREVIEW_CODE : null) ??
      displayDuty.teachers[0]?.code ??
      null
    setSelectedCode(fallback)
  }, [displayDuty, ownTeacher, user?.role, startYear])

  const activeTeacher = useMemo(
    () => displayDuty?.teachers.find((t) => t.code === selectedCode) ?? ownTeacher,
    [displayDuty, selectedCode, ownTeacher],
  )

  const showTeacherPicker = user?.role === 'admin' && view === 'mine' && !editing

  const enterEdit = () => {
    if (!duty || !isAdmin) return
    setView('dept')
    setDraft(cloneDuty(duty))
    setEditing(true)
    setDirty(false)
  }

  const exitEdit = () => {
    setEditing(false)
    setDraft(null)
    setDirty(false)
  }

  const onDraftItems = (items: DeptDutyItem[]) => {
    if (!draft) return
    setDraft(
      withDerivedDeptTeachers({
        ...draft,
        items,
        teachers: draft.teachers,
      }),
    )
    setDirty(true)
  }

  const onDiscard = () => {
    setPendingDeleteId(null)
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
  }

  const onSave = async () => {
    if (!draft || !user) return
    setSaving(true)
    const result = await saveDeptDuty(draft, user)
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
      message: `${result.duty.label} 職責分工已更新。`,
    })
  }

  const requestDelete = (itemId: number) => {
    const item = draft?.items.find((i) => i.id === itemId)
    setPendingDeleteId(itemId)
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
    onDraftItems(items)
    setPendingDeleteId(null)
    setDialog(null)
  }

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
          <p className="empty-note">載入職責資料中…</p>
        </GlassPanel>
      ) : !displayDuty ? (
        <GlassPanel className="reveal-up delay-1">
          <p className="empty-note">
            {formatAcademicYearLabel(startYear)} 的職責分工資料尚未匯入。
          </p>
        </GlassPanel>
      ) : (
        <>
          <GlassPanel className="papers-toolbar reveal-up delay-1">
            <div className="papers-view-tabs" role="tablist" aria-label="職責資料檢視">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'mine'}
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
                  <button type="button" className="papers-toolbar-action" onClick={enterEdit}>
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
                <p className="empty-note">找不到與您配對的職責紀錄。</p>
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
                  onChange={onDraftItems}
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
