import type { GradeDutyRow, TeacherDutyRow } from '../../data/assessmentDutyTypes'
import type { AssessmentDutyYear } from '../../data/assessmentDutyTypes'
import type { EcAppendixRow, TeacherDutyItem } from '../../data/assessmentDutyParse'
import {
  buildGradeDisplayRows,
  buildMineDutySections,
  formatTeacherDutyLine,
  formatTeacherLabel,
  mineDutyGroups,
  semesterGroupLabel,
  semesterGroupsInRows,
  type GradeDutyDisplayRow,
  type MineDutySections,
} from '../../data/assessmentDutyDisplay'
import { workloadTierLabel } from '../../data/assessmentDuty'

export function TeacherIdentity({
  code,
  nameMap,
}: {
  code: string
  nameMap: Map<string, string>
}) {
  const { name, code: c, known } = formatTeacherLabel(code, nameMap)
  return (
    <span className="duty-teacher-id">
      <span className="duty-teacher-name">{name}</span>
      {known ? <span className="duty-teacher-code">{c}</span> : null}
    </span>
  )
}

export function DutyGradeCard({
  gradeRow,
  nameMap,
  open,
  onOpenChange,
}: {
  gradeRow: GradeDutyRow
  nameMap: Map<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <details
      className="papers-grade-details"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="papers-grade-card-head">
        <span className="papers-grade-chevron" aria-hidden="true" />
        <h2>{gradeRow.gradeShort}</h2>
        {gradeRow.gradeLabel !== gradeRow.gradeShort ? (
          <span className="papers-grade-meta">{gradeRow.gradeLabel}</span>
        ) : null}
      </summary>
      <div className="papers-grade-card-body">
        <DutyGradeTable gradeRow={gradeRow} nameMap={nameMap} />
      </div>
    </details>
  )
}

export function DutyGradeTable({
  gradeRow,
  nameMap,
}: {
  gradeRow: GradeDutyRow
  nameMap: Map<string, string>
}) {
  const rows = buildGradeDisplayRows(gradeRow, nameMap)
  if (!rows.length) return <span className="duty-empty">—</span>

  const groups = semesterGroupsInRows(rows)

  return (
    <table className="duty-grade-table">
      <thead>
        <tr>
          <th className="duty-semester-col">學期</th>
          <th>考核項目</th>
          <th>部別</th>
          <th>負責教師</th>
          <th>權重</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const groupRows = rows.filter((r) => r.semesterGroup === group)
          return groupRows.map((row, idx) => (
            <GradeRow
              key={`${group}-${row.categoryKey}-${row.partLabel}-${row.teacherCode}-${idx}`}
              row={row}
              nameMap={nameMap}
              showGroupLabel={idx === 0}
              groupLabel={semesterGroupLabel(group)}
              rowSpan={idx === 0 ? groupRows.length : undefined}
            />
          ))
        })}
      </tbody>
    </table>
  )
}

function GradeRow({
  row,
  nameMap,
  showGroupLabel,
  groupLabel,
  rowSpan,
}: {
  row: GradeDutyDisplayRow
  nameMap: Map<string, string>
  showGroupLabel: boolean
  groupLabel: string
  rowSpan?: number
}) {
  return (
    <tr>
      {showGroupLabel ? (
        <th scope="rowgroup" rowSpan={rowSpan} className="duty-semester-cell">
          {groupLabel}
        </th>
      ) : null}
      <td>{row.itemLabel}</td>
      <td>{row.partLabel}</td>
      <td>
        <TeacherIdentity code={row.teacherCode} nameMap={nameMap} />
      </td>
      <td className="duty-weight-cell">{row.weight ?? '—'}</td>
    </tr>
  )
}

export function DutyTeacherDuties({ items }: { items: TeacherDutyItem[] }) {
  if (!items.length) return <span className="duty-empty">—</span>

  return (
    <ul className="duty-line-list">
      {items.map((item, i) => (
        <li key={`${item.grade}-${item.task}-${i}`}>{formatTeacherDutyLine(item)}</li>
      ))}
    </ul>
  )
}

export function DutyAppendixPanel({
  rows,
  nameMap,
  open,
  onOpenChange,
}: {
  rows: EcAppendixRow[]
  nameMap: Map<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!rows.length) return null

  return (
    <details
      className="papers-appendix-details"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="papers-appendix-head">
        <span className="papers-grade-chevron" aria-hidden="true" />
        <h2>附錄：EC 延伸課程考核</h2>
      </summary>
      <div className="papers-appendix-body">
        <p className="papers-appendix-hint">
          延伸課程（EC）班級的卷一、卷二擬題分工；與上方一般行政班分工分開列示。
        </p>
        <div className="table-wrap">
          <table className="papers-ec-table">
            <thead>
              <tr>
                <th>年級</th>
                <th colSpan={2}>上學期</th>
                <th colSpan={2}>下學期</th>
              </tr>
              <tr className="papers-ec-subhead">
                <th />
                <th>卷一</th>
                <th>卷二</th>
                <th>卷一</th>
                <th>卷二</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.grade}>
                  <th scope="row">{row.grade}</th>
                  <td>
                    <EcTeacherCell code={row.firstPaper1} nameMap={nameMap} />
                  </td>
                  <td>
                    <EcTeacherCell code={row.firstPaper2} nameMap={nameMap} />
                  </td>
                  <td>
                    <EcTeacherCell code={row.secondPaper1} nameMap={nameMap} />
                  </td>
                  <td>
                    <EcTeacherCell code={row.secondPaper2} nameMap={nameMap} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

function EcTeacherCell({
  code,
  nameMap,
}: {
  code: string | null
  nameMap: Map<string, string>
}) {
  if (!code) return <span className="duty-empty">—</span>
  return <TeacherIdentity code={code} nameMap={nameMap} />
}

export function PapersLegend() {
  return (
    <details className="papers-legend-panel">
      <summary>閱讀說明</summary>
      <ul>
        <li>
          <strong>我的出卷</strong>：預設顯示您（或所選老師）上、下學期負責的卷別與權重。
        </li>
        <li>
          <strong>按年級查</strong>：按年級查看各考核項目的負責教師。
        </li>
        <li>
          <strong>按教師查</strong>：全體老師分工總表，可按姓名或權重排序。
        </li>
        <li>
          <strong>權重</strong>：擬題工作量單位（色標：紅 ≥3.0、橙 ≥2.5、黃 ≥2.0、綠 &lt;2.0）。
        </li>
      </ul>
    </details>
  )
}

export function DutyTeacherPicker({
  teachers,
  selectedCode,
  onSelect,
  showHint,
  layout = 'sidebar',
}: {
  teachers: TeacherDutyRow[]
  selectedCode: string | null
  onSelect: (code: string) => void
  showHint?: boolean
  layout?: 'sidebar' | 'bar'
}) {
  const sorted = [...teachers].sort((a, b) =>
    a.code.localeCompare(b.code, 'en'),
  )

  return (
    <aside
      className={`papers-teacher-picker papers-teacher-picker-${layout}`}
      aria-label="選擇老師"
    >
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
      {showHint ? (
        <p className="papers-teacher-picker-hint">管理員可點選代碼預覽各老師出卷分工</p>
      ) : null}
    </aside>
  )
}

function MineDutySheet({ sections }: { sections: MineDutySections }) {
  const groups = mineDutyGroups(sections)
  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0)

  if (!rowCount) {
    return <p className="papers-mine-empty">本學年無出卷分工</p>
  }

  return (
    <div className="papers-mine-sheet">
      <table className="papers-mine-table">
        <colgroup>
          <col className="papers-mine-col-term" />
          <col className="papers-mine-col-grade" />
          <col className="papers-mine-col-paper" />
          <col className="papers-mine-col-part" />
          <col className="papers-mine-col-weight" />
        </colgroup>
        <thead>
          <tr>
            <th>學期</th>
            <th>年級</th>
            <th>卷別</th>
            <th>分部</th>
            <th>權重</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            group.rows.map((row, idx) => (
              <tr key={`${group.label}-${row.grade}-${row.paper}-${row.part}-${idx}`}>
                {idx === 0 ? (
                  <th scope="rowgroup" rowSpan={group.rows.length} className="papers-mine-term">
                    {group.label}
                  </th>
                ) : null}
                <td>{row.grade}</td>
                <td>{row.paper}</td>
                <td className={`papers-mine-part${row.part === '—' ? ' is-empty' : ''}`}>
                  {row.part}
                </td>
                <td className="papers-mine-weight">{row.weight ?? '—'}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

export function DutyMyPanel({
  teacher,
  duty,
  nameMap,
  teachers,
  selectedCode,
  onSelectTeacher,
}: {
  teacher: TeacherDutyRow
  duty: AssessmentDutyYear
  nameMap: Map<string, string>
  teachers?: TeacherDutyRow[]
  selectedCode?: string | null
  onSelectTeacher?: (code: string) => void
}) {
  const sections = buildMineDutySections(teacher.code, duty)
  const { name } = formatTeacherLabel(teacher.code, nameMap)
  const showPicker = teachers != null && onSelectTeacher != null

  return (
    <div className="papers-mine-panel">
      <header className="papers-mine-head">
        <div className="papers-mine-identity">
          <h2>{name}</h2>
          <p className="papers-mine-code">{teacher.code}</p>
        </div>
        {teacher.totalWeight != null ? (
          <span
            className={`duty-weight duty-tier ${teacher.workloadTier}`}
            title={workloadTierLabel(teacher.workloadTier)}
          >
            學年權重 {teacher.totalWeight}
          </span>
        ) : (
          <span className="duty-empty papers-mine-weight-badge">學年權重 —</span>
        )}
      </header>

      {showPicker ? (
        <DutyTeacherPicker
          teachers={teachers}
          selectedCode={selectedCode ?? teacher.code}
          onSelect={onSelectTeacher}
          showHint
          layout="bar"
        />
      ) : null}

      <MineDutySheet sections={sections} />
    </div>
  )
}
