import {
  TeacherCodeSelect,
  teacherSelectOptions,
} from '../duty/DutyEditControls'
import type {
  AssessmentDutyCategoryKey,
  AssessmentDutyYear,
  GradeDutyRow,
} from '../../data/assessmentDutyTypes'
import type { DutyPart, DutySemester, DutySlot, EcAppendixRow } from '../../data/assessmentDutyParse'
import { GRADE_CATEGORY_ORDER } from '../../data/assessmentDutyDisplay'

const SEMESTER_OPTIONS: { value: DutySemester; label: string }[] = [
  { value: 'first', label: '上學期' },
  { value: 'second', label: '下學期' },
  { value: 'both', label: '全年' },
  { value: 'mock', label: 'Mock' },
  { value: 'year', label: '學年' },
]

const PART_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: '甲', label: '甲部' },
  { value: '乙', label: '乙部' },
  { value: '甲乙', label: '甲乙' },
]

function emptySlot(fallbackCode: string): DutySlot {
  return {
    semester: 'first',
    part: null,
    note: null,
    teacherCode: fallbackCode,
    weight: null,
  }
}

function SlotEditor({
  slot,
  options,
  categoryLabels,
  categoryKey,
  onChange,
  onRemove,
}: {
  slot: DutySlot
  options: { code: string; name: string }[]
  categoryLabels: AssessmentDutyYear['categoryShortLabels']
  categoryKey: AssessmentDutyCategoryKey
  onChange: (next: DutySlot) => void
  onRemove: () => void
}) {
  return (
    <div className="papers-slot-editor">
      <span className="papers-slot-cat">{categoryLabels[categoryKey]}</span>
      <select
        className="duty-teacher-select"
        aria-label="學期"
        value={slot.semester}
        onChange={(e) =>
          onChange({ ...slot, semester: e.target.value as DutySemester })
        }
      >
        {SEMESTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="duty-teacher-select"
        aria-label="部別"
        value={slot.part ?? ''}
        onChange={(e) =>
          onChange({
            ...slot,
            part: (e.target.value || null) as DutyPart | null,
          })
        }
      >
        {PART_OPTIONS.map((o) => (
          <option key={o.value || 'none'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        className="duty-note-input"
        placeholder="備註"
        value={slot.note ?? ''}
        onChange={(e) =>
          onChange({
            ...slot,
            note: e.target.value.trim() ? e.target.value.trim() : null,
          })
        }
      />
      <TeacherCodeSelect
        value={slot.teacherCode}
        options={options}
        onChange={(code) => onChange({ ...slot, teacherCode: code })}
        ariaLabel="負責教師"
      />
      <input
        className="duty-weight-input"
        type="number"
        step="0.25"
        min="0"
        placeholder="權重"
        value={slot.weight ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          onChange({
            ...slot,
            weight: raw === '' ? null : Number(raw),
          })
        }}
      />
      <button type="button" className="duty-icon-btn danger" aria-label="刪除格子" onClick={onRemove}>
        ×
      </button>
    </div>
  )
}

export function EditableGradeMatrix({
  duty,
  nameMap,
  onChange,
  onRequestDeleteGrade,
}: {
  duty: AssessmentDutyYear
  nameMap: Map<string, string>
  onChange: (gradeMatrix: GradeDutyRow[]) => void
  onRequestDeleteGrade: (gradeLabel: string) => void
}) {
  const options = teacherSelectOptions(nameMap)
  const fallbackCode = options[0]?.code ?? 'TWL'

  const updateGradeAt = (index: number, patch: Partial<GradeDutyRow>) => {
    onChange(
      duty.gradeMatrix.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  const updateSlotsAt = (
    index: number,
    categoryKey: AssessmentDutyCategoryKey,
    slots: DutySlot[],
  ) => {
    onChange(
      duty.gradeMatrix.map((row, i) => {
        if (i !== index) return row
        const categories = { ...row.categories }
        if (slots.length) categories[categoryKey] = slots
        else delete categories[categoryKey]
        return { ...row, categories }
      }),
    )
  }

  const addGrade = () => {
    const n = duty.gradeMatrix.length + 1
    onChange([
      ...duty.gradeMatrix,
      {
        gradeLabel: `新年級 ${n}`,
        gradeShort: `年級${n}`,
        categories: {},
      },
    ])
  }

  return (
    <div className="papers-grade-edit-list">
      {duty.gradeMatrix.map((row, gradeIdx) => (
        <section key={gradeIdx} className="papers-grade-edit-card">
          <header className="papers-grade-edit-head">
            <input
              className="duty-text-input"
              value={row.gradeShort}
              aria-label="年級簡稱"
              onChange={(e) => updateGradeAt(gradeIdx, { gradeShort: e.target.value })}
            />
            <input
              className="duty-text-input duty-title-input"
              value={row.gradeLabel}
              aria-label="年級全名"
              onChange={(e) => updateGradeAt(gradeIdx, { gradeLabel: e.target.value })}
            />
            <button
              type="button"
              className="duty-icon-btn danger"
              aria-label="刪除年級"
              onClick={() => onRequestDeleteGrade(row.gradeLabel)}
            >
              刪除年級
            </button>
          </header>

          {GRADE_CATEGORY_ORDER.map((categoryKey) => {
            const slots = row.categories[categoryKey] ?? []
            return (
              <div key={categoryKey} className="papers-category-edit">
                <div className="papers-category-edit-head">
                  <h3>{duty.categoryLabels[categoryKey]}</h3>
                  <button
                    type="button"
                    className="duty-add-btn"
                    onClick={() =>
                      updateSlotsAt(gradeIdx, categoryKey, [
                        ...slots,
                        emptySlot(fallbackCode),
                      ])
                    }
                  >
                    ＋ 加格子
                  </button>
                </div>
                {slots.length === 0 ? (
                  <p className="duty-empty">尚無分工</p>
                ) : (
                  slots.map((slot, idx) => (
                    <SlotEditor
                      key={`${categoryKey}-${idx}`}
                      slot={slot}
                      options={options}
                      categoryLabels={duty.categoryShortLabels}
                      categoryKey={categoryKey}
                      onChange={(next) => {
                        const copy = [...slots]
                        copy[idx] = next
                        updateSlotsAt(gradeIdx, categoryKey, copy)
                      }}
                      onRemove={() =>
                        updateSlotsAt(
                          gradeIdx,
                          categoryKey,
                          slots.filter((_, i) => i !== idx),
                        )
                      }
                    />
                  ))
                )}
              </div>
            )
          })}
        </section>
      ))}
      <button type="button" className="duty-add-item-btn" onClick={addGrade}>
        ＋ 新增年級列
      </button>
    </div>
  )
}

export function EditableEcAppendix({
  rows,
  nameMap,
  onChange,
}: {
  rows: EcAppendixRow[]
  nameMap: Map<string, string>
  onChange: (next: EcAppendixRow[]) => void
}) {
  const options = teacherSelectOptions(nameMap)

  const updateRow = (idx: number, patch: Partial<EcAppendixRow>) => {
    onChange(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  return (
    <div className="papers-ec-edit">
      <div className="table-wrap">
        <table className="papers-ec-table papers-ec-table-edit">
          <thead>
            <tr>
              <th>年級</th>
              <th>上·卷一</th>
              <th>上·卷二</th>
              <th>下·卷一</th>
              <th>下·卷二</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    className="duty-text-input"
                    value={row.grade}
                    onChange={(e) => updateRow(idx, { grade: e.target.value })}
                  />
                </td>
                {(
                  [
                    'firstPaper1',
                    'firstPaper2',
                    'secondPaper1',
                    'secondPaper2',
                  ] as const
                ).map((field) => (
                  <td key={field}>
                    <TeacherCodeSelect
                      value={row[field] ?? ''}
                      options={options}
                      allowEmpty
                      onChange={(code) => updateRow(idx, { [field]: code || null })}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="duty-icon-btn danger"
                    aria-label="刪除 EC 列"
                    onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="duty-add-item-btn"
        onClick={() =>
          onChange([
            ...rows,
            {
              grade: '新年級',
              firstPaper1: null,
              firstPaper2: null,
              secondPaper1: null,
              secondPaper2: null,
            },
          ])
        }
      >
        ＋ 新增 EC 列
      </button>
    </div>
  )
}
