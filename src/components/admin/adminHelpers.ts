import type { GradeDeadline } from '../../types'

export type DeadlineDraft = Omit<GradeDeadline, 'submitted'>

export type FieldError = { title?: boolean; due?: boolean }

export type DialogState =
  | { kind: 'notice'; title: string; message: string }
  | {
      kind: 'confirm'
      title: string
      message: string
      items: string[]
    }

export type CalAudienceMode = 'all' | 'grades' | 'teachers'

export const WEEKDAYS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
] as const

export function emptyDraft(grade: number): DeadlineDraft {
  return {
    grade,
    readingDue: '',
    activityTitle: '',
    activityDue: '',
  }
}

export function weekdayLabel(iso: string): string {
  if (!iso) return ''
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ''
  return WEEKDAYS[date.getDay()]
}

export function isDeadlineComplete(draft: DeadlineDraft): boolean {
  return Boolean(draft.activityTitle.trim() && draft.activityDue)
}

export function missingDeadlineFields(draft: DeadlineDraft): string[] {
  const missing: string[] = []
  if (!draft.activityTitle.trim()) missing.push('活動名稱')
  if (!draft.activityDue) missing.push('活動截止日期')
  return missing
}
