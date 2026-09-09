import { useEffect, useEffectEvent, type MutableRefObject, type RefObject } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import {
  isTypingTarget,
  parseIsoDate,
  shiftIso,
} from './calendarDateUtils'
import type { EventClipboard } from './calendarClipboard'

type UseCalendarKeyboardArgs = {
  editingId: string | null
  clipboard: EventClipboard[] | null
  selectedEventIds: Set<string>
  selectedIso: string
  pinned: boolean
  hoverIso: string | null
  todayIso: string
  hoveringDayRef: MutableRefObject<boolean>
  quickInputRef: RefObject<HTMLInputElement | null>
  setClipboard: (value: EventClipboard[] | null) => void
  setSelectedEventIds: (value: Set<string>) => void
  setPasteNotice: (value: string | null) => void
  setPinned: (value: boolean) => void
  setSelectedIso: (value: string) => void
  setEditingId: (value: string | null) => void
  setYear: (value: number) => void
  setMonthIndex: (value: number) => void
  setSearchParams: SetURLSearchParams
  copySelectedEvents: () => boolean
  pasteClipboardToDate: (iso: string) => boolean
  undoLastPaste: () => boolean
  removeSelectedEvents: () => boolean
  focusDay: (iso: string, clearEvent?: boolean) => void
}

export function useCalendarKeyboard({
  editingId,
  clipboard,
  selectedEventIds,
  selectedIso,
  pinned,
  hoverIso,
  todayIso,
  hoveringDayRef,
  quickInputRef,
  setClipboard,
  setSelectedEventIds,
  setPasteNotice,
  setPinned,
  setSelectedIso,
  setEditingId,
  setYear,
  setMonthIndex,
  setSearchParams,
  copySelectedEvents,
  pasteClipboardToDate,
  undoLastPaste,
  removeSelectedEvents,
  focusDay,
}: UseCalendarKeyboardArgs) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (editingId || isTypingTarget(e.target)) return

    if (e.key === 'Escape') {
      if (clipboard || selectedEventIds.size > 0) {
        e.preventDefault()
        setClipboard(null)
        setSelectedEventIds(new Set())
        setPasteNotice(null)
        return
      }
      if (pinned) {
        e.preventDefault()
        setPinned(false)
        if (hoverIso) setSelectedIso(hoverIso)
      }
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      if (undoLastPaste()) {
        e.preventDefault()
      }
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      if (copySelectedEvents()) {
        e.preventDefault()
      }
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      if (clipboard?.length) {
        e.preventDefault()
        if (pasteClipboardToDate(selectedIso)) {
          focusDay(selectedIso, false)
        }
      }
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedEventIds.size === 0) return
      e.preventDefault()
      removeSelectedEvents()
      return
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      if (!hoveringDayRef.current) return
      e.preventDefault()
      quickInputRef.current?.focus()
      quickInputRef.current?.select()
      return
    }

    let delta = 0
    if (e.key === 'ArrowLeft') delta = -1
    else if (e.key === 'ArrowRight') delta = 1
    else if (e.key === 'ArrowUp') delta = -7
    else if (e.key === 'ArrowDown') delta = 7
    else return

    e.preventDefault()
    const nextIso = shiftIso(selectedIso, delta)
    setSelectedIso(nextIso)
    setEditingId(null)
    setSelectedEventIds(new Set())
    const d = parseIsoDate(nextIso)
    if (d) {
      setYear(d.getFullYear())
      setMonthIndex(d.getMonth())
    }
    if (pinned) {
      setSearchParams(
        nextIso === todayIso ? {} : { date: nextIso },
        { replace: true },
      )
    }
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('.detail-cal-day.selected')
        ?.focus({ preventScroll: true })
    })
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
