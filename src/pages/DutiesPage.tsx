import { useEffect, useMemo, useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import {
  getDeptDuty,
  listDeptDutyYears,
  resolveDeptDutyTeacher,
  roleLabel,
  sortTeacherDutyLines,
} from '../data/deptDuty'
import type {
  DeptDutyItem,
  DeptDutyPerson,
  TeacherDeptDuty,
} from '../data/deptDutyTypes'

type ViewMode = 'mine' | 'dept'

const ADMIN_PREVIEW_CODE = 'YLN'

function PersonChip({ person }: { person: DeptDutyPerson }) {
  return (
    <span className="duties-person">
      <span className="duties-person-name">{person.name}</span>
      <span className="duties-person-code">{person.code}</span>
      {person.note ? (
        <span className="duties-person-note">{person.note}</span>
      ) : null}
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

export function DutiesPage() {
  const { user } = useAuth()
  const dutyYears = listDeptDutyYears()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = dutyYears.includes(defaultStart)
    ? defaultStart
    : (dutyYears[0] ?? defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [view, setView] = useState<ViewMode>('mine')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const duty = getDeptDuty(startYear)
  const yearOptions = listAcademicYearStarts().filter((y) => dutyYears.includes(y))

  const ownTeacher = useMemo(
    () => (duty ? resolveDeptDutyTeacher(user?.id, duty.teachers) : null),
    [duty, user?.id],
  )

  useEffect(() => {
    if (!duty) return
    const fallback =
      ownTeacher?.code ??
      (user?.role === 'admin' ? ADMIN_PREVIEW_CODE : null) ??
      duty.teachers[0]?.code ??
      null
    setSelectedCode(fallback)
  }, [duty, ownTeacher, user?.role, startYear])

  const activeTeacher = useMemo(
    () => duty?.teachers.find((t) => t.code === selectedCode) ?? ownTeacher,
    [duty, selectedCode, ownTeacher],
  )

  const showTeacherPicker = user?.role === 'admin' && view === 'mine'

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
          onSelectYear={setStartYear}
        />
      </header>

      {!duty ? (
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
          </GlassPanel>

          {view === 'mine' ? (
            <GlassPanel className="papers-mine-layout reveal-up delay-2">
              {activeTeacher ? (
                <MineDuties
                  teacher={activeTeacher}
                  teachers={showTeacherPicker ? duty.teachers : undefined}
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
                  {duty.label} · {duty.items.length} 項
                </p>
              </div>
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
                    {duty.items.map((item) => (
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
            </GlassPanel>
          )}
        </>
      )}
    </div>
  )
}
