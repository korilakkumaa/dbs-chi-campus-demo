import { useMemo } from 'react'
import {
  TeacherCodeSelect,
  teacherSelectOptions,
} from './DutyEditControls'
import {
  deptDutyNameMap,
  roleLabel,
  sortTeacherDutyLines,
} from '../../data/deptDuty'
import type {
  DeptDutyItem,
  DeptDutyMemberGroup,
  DeptDutyPerson,
  DeptDutyYear,
  TeacherDeptDuty,
} from '../../data/deptDutyTypes'
import { teacherWhitelistForYear } from '../../data/teacherWhitelist'

type MemberMode = 'list' | 'all' | 'groups'

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

export function PersonList({ people }: { people: DeptDutyPerson[] }) {
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

export function ItemMembers({ item }: { item: DeptDutyItem }) {
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

export function MineDuties({
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
  onChange,
}: {
  people: DeptDutyPerson[]
  options: { code: string; name: string }[]
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
  onChange,
}: {
  groups: DeptDutyMemberGroup[]
  options: { code: string; name: string }[]
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

export function EditableDeptTable({
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
  const options = teacherSelectOptions(nameMap)

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
                      onChange={(memberGroups) => updateItem(item.id, { memberGroups })}
                    />
                  ) : (
                    <PersonEditor
                      people={item.members}
                      options={options}
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

