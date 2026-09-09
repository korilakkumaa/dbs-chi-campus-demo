import type { RefObject } from 'react'
import { resolveEventTime } from '../../data/calendarIcs'
import {
  dayStatusCustomNote,
  EVENT_KIND_META,
  formatEventDateLabel,
  isColourOnlyDayStatus,
} from '../../data/calendarEvents'
import { canMutateCalendarEvent } from '../../data/calendarStore'
import type { CalendarEvent, User } from '../../types'
import { QuickEventInput } from './QuickEventInput'
import { EventMark } from './EventMark'

type Props = {
  selectedIso: string
  pinned: boolean
  isAdmin: boolean
  selectedEvents: CalendarEvent[]
  selectedEventIds: Set<string>
  editingId: string | null
  draft: string
  draftStart: string
  draftEnd: string
  sideEditRef: RefObject<HTMLInputElement | null>
  quickInputRef: RefObject<HTMLInputElement | null>
  user: Pick<User, 'id' | 'role'> | null | undefined
  onSelectEventIds: (updater: (prev: Set<string>) => Set<string>) => void
  onClearPasteNotice: () => void
  onDraftChange: (value: string) => void
  onDraftStartChange: (value: string) => void
  onDraftEndChange: (value: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onStartEdit: (event: CalendarEvent) => void
  onDeleteEvent: (id: string) => void
  onAddQuickEvent: (payload: {
    title: string
    date: string
    kind: CalendarEvent['kind']
    time?: CalendarEvent['time']
  }) => void
}

export function CalendarDayDetail({
  selectedIso,
  pinned,
  isAdmin,
  selectedEvents,
  selectedEventIds,
  editingId,
  draft,
  draftStart,
  draftEnd,
  sideEditRef,
  quickInputRef,
  user,
  onSelectEventIds,
  onClearPasteNotice,
  onDraftChange,
  onDraftStartChange,
  onDraftEndChange,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onDeleteEvent,
  onAddQuickEvent,
}: Props) {
  const sideEvents = selectedEvents.filter(
    (event) => isAdmin || !isColourOnlyDayStatus(event),
  )

  return (
    <>
      <div className="detail-cal-side-head">
        <p className="detail-cal-side-label">
          {formatEventDateLabel(selectedIso)}
        </p>
        {pinned && (
          <span
            className="detail-cal-side-pinned"
            title="再點該日或按 Esc 解除鎖定"
          >
            已鎖定
          </span>
        )}
      </div>
      {sideEvents.length === 0 ? (
        <p className="detail-cal-side-empty">這一天尚無事件</p>
      ) : (
        <ul className="detail-cal-side-list" aria-label="當日事件">
          {sideEvents.map((event) => {
            const meta = EVENT_KIND_META[event.kind]
            const editing = event.id === editingId
            const slot = resolveEventTime(event)
            const colourOnly = isColourOnlyDayStatus(event)
            const customNote = dayStatusCustomNote(event)
            const displayTitle = colourOnly
              ? '（僅顏色標記）'
              : customNote ||
                event.title.trim() ||
                event.lesson?.subject ||
                ''
            const mutable = canMutateCalendarEvent(user, event)
            const rowSelected = selectedEventIds.has(event.id)
            return (
              <li
                key={event.id}
                className={[
                  'detail-cal-side-row',
                  event.kind === 'holiday' ? 'holiday' : '',
                  event.kind === 'non-school-day' ? 'non-school-day' : '',
                  event.lesson ? 'has-lesson' : '',
                  colourOnly ? 'colour-only' : 'selectable',
                  rowSelected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(e) => {
                  const additive = e.metaKey || e.ctrlKey
                  onSelectEventIds((prev) => {
                    if (additive) {
                      const next = new Set(prev)
                      if (next.has(event.id)) next.delete(event.id)
                      else next.add(event.id)
                      return next
                    }
                    return new Set([event.id])
                  })
                  onClearPasteNotice()
                }}
              >
                <span className="detail-cal-side-kind">
                  <EventMark kind={event.kind} />
                  <span>{meta.label}</span>
                </span>
                {event.lesson && (
                  <div className="detail-cal-side-tags">
                    {event.lesson.group ? (
                      <span className="detail-cal-side-tag group">
                        {event.lesson.group}
                      </span>
                    ) : null}
                    {event.lesson.subject ? (
                      <span className="detail-cal-side-tag subject">
                        {event.lesson.subject}
                      </span>
                    ) : null}
                  </div>
                )}
                {slot && (
                  <span className="detail-cal-side-tag time standalone">
                    {slot.start}–{slot.end}
                  </span>
                )}
                {editing ? (
                  <>
                    <input
                      ref={sideEditRef}
                      className="detail-cal-side-edit"
                      value={draft}
                      autoFocus
                      placeholder="說明（可留空）"
                      onChange={(e) => onDraftChange(e.target.value)}
                      onBlur={onCommitEdit}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return
                        if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                          e.preventDefault()
                          e.stopPropagation()
                          onCommitEdit()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          onCancelEdit()
                        }
                      }}
                    />
                    <div className="detail-cal-side-time-edit">
                      <input
                        type="time"
                        value={draftStart}
                        aria-label="開始時間"
                        onChange={(e) => onDraftStartChange(e.target.value)}
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={draftEnd}
                        aria-label="結束時間"
                        onChange={(e) => onDraftEndChange(e.target.value)}
                      />
                    </div>
                  </>
                ) : mutable ? (
                  <button
                    type="button"
                    className={`detail-cal-side-title${displayTitle && !colourOnly ? '' : ' empty'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartEdit(event)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onStartEdit(event)
                    }}
                  >
                    {displayTitle || '\u00a0'}
                  </button>
                ) : (
                  <span
                    className={`detail-cal-side-title${displayTitle && !colourOnly ? '' : ' empty'}`}
                  >
                    {displayTitle || '\u00a0'}
                  </span>
                )}
                {mutable && (
                  <button
                    type="button"
                    className="detail-cal-side-delete"
                    aria-label={`刪除事件`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteEvent(event.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <QuickEventInput
        date={selectedIso}
        inputRef={quickInputRef}
        onAdd={onAddQuickEvent}
      />
    </>
  )
}
