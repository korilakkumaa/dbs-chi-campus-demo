import { useState } from 'react'
import { GlassPanel } from '../GlassPanel'
import { GRADE_LEVELS, gradeLabel } from '../../data/teacherWhitelist'
import type { GradeDeadline } from '../../types'
import { AdminDialog, SubmitTick } from './AdminDialog'
import {
  emptyDraft,
  isDeadlineComplete,
  missingDeadlineFields,
  weekdayLabel,
  type DeadlineDraft,
  type DialogState,
  type FieldError,
} from './adminHelpers'

type Props = {
  gradeDeadlines: GradeDeadline[]
  updateGradeDeadline: (
    grade: number,
    patch: Partial<GradeDeadline>,
  ) => void
  submitGradeDeadlines: (rows: GradeDeadline[]) => void
}

export function AdminDeadlinesPanel({
  gradeDeadlines,
  updateGradeDeadline,
  submitGradeDeadlines,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, DeadlineDraft>>(() => {
    const init: Record<number, DeadlineDraft> = {}
    for (const grade of GRADE_LEVELS) {
      const row = gradeDeadlines.find((d) => d.grade === grade)
      init[grade] = row
        ? {
            grade,
            readingDue: '',
            activityTitle: row.activityTitle,
            activityDue: row.activityDue,
          }
        : emptyDraft(grade)
    }
    return init
  })
  const [selected, setSelected] = useState<Set<number>>(
    () =>
      new Set(gradeDeadlines.filter((d) => d.submitted).map((d) => d.grade)),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<number, FieldError>>(
    {},
  )
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const patchDraft = (grade: number, patch: Partial<DeadlineDraft>) => {
    const nextDraft: DeadlineDraft = {
      ...(drafts[grade] ?? emptyDraft(grade)),
      ...patch,
      grade,
      readingDue: '',
    }
    setDrafts((prev) => ({
      ...prev,
      [grade]: nextDraft,
    }))
    setFieldErrors((prev) => {
      const cur = prev[grade]
      if (!cur) return prev
      const nextErr: FieldError = {
        title: cur.title && !nextDraft.activityTitle.trim() ? true : undefined,
        due: cur.due && !nextDraft.activityDue ? true : undefined,
      }
      if (!nextErr.title && !nextErr.due) {
        const { [grade]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [grade]: nextErr }
    })
    if (!isDeadlineComplete(nextDraft)) {
      setSelected((prev) => {
        if (!prev.has(grade)) return prev
        const next = new Set(prev)
        next.delete(grade)
        return next
      })
    }
    const saved = gradeDeadlines.find((d) => d.grade === grade)
    if (saved?.submitted && !isDeadlineComplete(nextDraft)) {
      updateGradeDeadline(grade, { submitted: false })
    }
  }

  const onSelectToggle = (grade: number, on: boolean) => {
    if (!on) {
      setSelected((prev) => {
        if (!prev.has(grade)) return prev
        const next = new Set(prev)
        next.delete(grade)
        return next
      })
      return
    }
    const draft = drafts[grade] ?? emptyDraft(grade)
    const missing = missingDeadlineFields(draft)
    if (missing.length > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        [grade]: {
          title: !draft.activityTitle.trim() || undefined,
          due: !draft.activityDue || undefined,
        },
      }))
      return
    }
    setFieldErrors((prev) => {
      if (!prev[grade]) return prev
      const { [grade]: _, ...rest } = prev
      return rest
    })
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(grade)
      return next
    })
  }

  const onSelectAll = () => {
    setSelected(
      new Set(
        GRADE_LEVELS.filter((grade) =>
          isDeadlineComplete(drafts[grade] ?? emptyDraft(grade)),
        ),
      ),
    )
  }

  const performSubmit = () => {
    submitGradeDeadlines(
      GRADE_LEVELS.map((grade) => {
        const draft = drafts[grade] ?? emptyDraft(grade)
        const complete = isDeadlineComplete(draft)
        return {
          grade,
          readingDue: '',
          activityTitle: draft.activityTitle,
          activityDue: draft.activityDue,
          submitted: selected.has(grade) && complete,
        }
      }),
    )
    const cleared: Record<number, DeadlineDraft> = {}
    for (const grade of GRADE_LEVELS) {
      cleared[grade] = emptyDraft(grade)
    }
    setDrafts(cleared)
    setSelected(new Set())
    setFieldErrors({})
    setDialog(null)
  }

  const onSubmitAll = () => {
    const toSubmit = GRADE_LEVELS.filter((grade) => {
      const draft = drafts[grade] ?? emptyDraft(grade)
      return selected.has(grade) && isDeadlineComplete(draft)
    })
    if (toSubmit.length === 0) {
      setDialog({
        kind: 'notice',
        title: '尚未選取項目',
        message: '請先勾選已填妥活動名稱與截止日期的年級，再遞交。',
      })
      return
    }
    setDialog({
      kind: 'confirm',
      title: '確認遞交',
      message: `確定遞交以下 ${toSubmit.length} 項截止日期給相應任教老師？`,
      items: toSubmit.map((grade) => {
        const draft = drafts[grade] ?? emptyDraft(grade)
        const weekday = weekdayLabel(draft.activityDue)
        return `${gradeLabel(grade)}｜${draft.activityTitle.trim()}｜${draft.activityDue}${weekday ? `（${weekday}）` : ''}`
      }),
    })
  }

  return (
    <>
      <GlassPanel className="table-panel deadline-admin reveal-up delay-1">
        <div className="table-panel-head">
          <h2>年級截止日期</h2>
          <div className="deadline-admin-actions">
            <button
              type="button"
              className="deadline-select-all-btn"
              onClick={onSelectAll}
            >
              全選
            </button>
            <button
              type="button"
              className="deadline-submit-btn"
              onClick={onSubmitAll}
            >
              遞交
            </button>
          </div>
        </div>
        <p className="deadline-admin-lead">
          為每級設定活動名稱與截止日期；填妥兩者後才可勾選並遞交。未填妥時勾選會以紅色邊框標示空白欄位。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>年級</th>
                <th>活動名稱</th>
                <th>活動截止</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_LEVELS.map((grade) => {
                const draft = drafts[grade] ?? emptyDraft(grade)
                const complete = isDeadlineComplete(draft)
                const checked = selected.has(grade) && complete
                const weekday = weekdayLabel(draft.activityDue)
                const errors = fieldErrors[grade]
                return (
                  <tr
                    key={grade}
                    className={checked ? 'deadline-row-selected' : ''}
                  >
                    <td>{gradeLabel(grade)}</td>
                    <td>
                      <input
                        type="text"
                        className={`deadline-input text${errors?.title ? ' invalid' : ''}`}
                        placeholder="例如：書展參觀"
                        value={draft.activityTitle}
                        aria-invalid={Boolean(errors?.title)}
                        onChange={(e) =>
                          patchDraft(grade, {
                            activityTitle: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="deadline-due-cell">
                        <input
                          type="date"
                          className={`deadline-input${errors?.due ? ' invalid' : ''}`}
                          value={draft.activityDue}
                          aria-invalid={Boolean(errors?.due)}
                          onChange={(e) =>
                            patchDraft(grade, {
                              activityDue: e.target.value,
                            })
                          }
                        />
                        <span
                          className={`deadline-weekday${weekday ? '' : ' empty'}`}
                          aria-live="polite"
                        >
                          {weekday || '—'}
                        </span>
                        <SubmitTick
                          id={`deadline-select-${grade}`}
                          checked={checked}
                          onChange={(next) => onSelectToggle(grade, next)}
                          label={
                            checked
                              ? `取消選取 ${gradeLabel(grade)}`
                              : `選取 ${gradeLabel(grade)}`
                          }
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {dialog && (
        <AdminDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onConfirm={dialog.kind === 'confirm' ? performSubmit : undefined}
        />
      )}
    </>
  )
}
