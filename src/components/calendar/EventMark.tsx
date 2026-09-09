import { EVENT_KIND_META } from '../../data/calendarEvents'
import type { CalendarEventKind } from '../../types'

export function EventMark({ kind }: { kind: CalendarEventKind }) {
  const meta = EVENT_KIND_META[kind]
  if (meta.mode === 'text') {
    return (
      <span className="detail-cal-mark text" style={{ color: meta.color }}>
        ●
      </span>
    )
  }
  if (meta.mode === 'circle') {
    return (
      <span
        className="detail-cal-mark circle"
        style={{ borderColor: meta.color, color: meta.color }}
        aria-hidden
      >
        ○
      </span>
    )
  }
  return (
    <span
      className="detail-cal-mark dot"
      style={{ background: meta.color }}
      aria-hidden
    />
  )
}
