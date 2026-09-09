import { EVENT_KIND_META } from '../../data/calendarEvents'
import type { CalendarEvent, CalendarEventKind } from '../../types'

export type EventClipboard = {
  title: string
  kind: CalendarEventKind
  audience: CalendarEvent['audience']
  lesson?: CalendarEvent['lesson']
}

export function clipboardItemLabel(clip: EventClipboard): string {
  const title = clip.title.trim()
  if (title) return title
  if (clip.lesson?.subject) return clip.lesson.subject
  return EVENT_KIND_META[clip.kind].label
}

export function clipboardLabel(items: EventClipboard[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return clipboardItemLabel(items[0])
  return `${clipboardItemLabel(items[0])} 等 ${items.length} 項`
}

export function eventToClipboard(event: CalendarEvent): EventClipboard {
  return {
    title: event.title,
    kind: event.kind,
    audience: event.audience,
    ...(event.lesson ? { lesson: event.lesson } : {}),
  }
}
