import { expandIsoDateRange, isoDateLocal } from '../../data/calendarEvents'

export function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null
  }
  return date
}

export function shiftIso(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return isoDateLocal(date)
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function isoRangeInclusive(a: string, b: string): string[] {
  if (a <= b) return expandIsoDateRange(a, b)
  return expandIsoDateRange(b, a)
}
