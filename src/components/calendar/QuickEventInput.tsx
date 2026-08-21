import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import {
  EVENT_KIND_META,
  isoDateLocal,
} from '../../data/calendarEvents'
import type { CalendarEventKind } from '../../types'

const KIND_ORDER: CalendarEventKind[] = [
  'holiday',
  'non-school-day',
  'school-day',
  'timetable',
  'event',
  'progress',
  'department',
  'assessment',
]

function KindSwatch({ kind }: { kind: CalendarEventKind }) {
  const meta = EVENT_KIND_META[kind]
  if (meta.mode === 'text') {
    return (
      <span className="cal-quick-swatch text" style={{ color: meta.color }}>
        15
      </span>
    )
  }
  if (meta.mode === 'circle') {
    return (
      <span
        className="cal-quick-swatch circle"
        style={{ borderColor: meta.color, color: meta.color }}
      >
        15
      </span>
    )
  }
  return (
    <span
      className="cal-quick-swatch dot"
      style={{ background: meta.color }}
    />
  )
}

type Props = {
  date?: string
  inputRef?: Ref<HTMLInputElement>
  /** When `token` changes, fill title/kind and focus the input. */
  seed?: {
    token: number
    title: string
    kind: CalendarEventKind
  } | null
  onAdd: (input: {
    title: string
    date: string
    kind: CalendarEventKind
  }) => void
}

export function QuickEventInput({
  date: dateProp,
  inputRef,
  seed,
  onAdd,
}: Props) {
  const [kind, setKind] = useState<CalendarEventKind>('progress')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => dateProp ?? isoDateLocal())
  const [pickerOpen, setPickerOpen] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const localInputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  const setInputRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node
    if (typeof inputRef === 'function') inputRef(node)
    else if (inputRef) inputRef.current = node
  }

  useEffect(() => {
    if (dateProp) setDate(dateProp)
  }, [dateProp])

  useEffect(() => {
    if (!seed) return
    setTitle(seed.title)
    setKind(seed.kind)
    setPickerOpen(false)
    window.requestAnimationFrame(() => {
      const el = localInputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
  }, [seed])

  const commit = () => {
    const trimmed = title.trim()
    if (!trimmed || !date || savingRef.current) return
    savingRef.current = true
    onAdd({ title: trimmed, date, kind })
    setTitle('')
    window.setTimeout(() => {
      savingRef.current = false
    }, 0)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key !== 'Enter' && e.key !== 'NumpadEnter') return
    e.preventDefault()
    e.stopPropagation()
    commit()
  }

  return (
    <div className="cal-quick">
      <div className="cal-quick-type">
        <button
          type="button"
          className="cal-quick-type-btn"
          aria-label={`事件類型：${EVENT_KIND_META[kind].label}`}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
        >
          <KindSwatch kind={kind} />
        </button>
        {pickerOpen && (
          <div className="cal-quick-type-menu" role="listbox">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={k === kind}
                className={`cal-quick-type-option${k === kind ? ' active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  setKind(k)
                  setPickerOpen(false)
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <KindSwatch kind={k} />
                <span>{EVENT_KIND_META[k].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        ref={setInputRef}
        className="cal-quick-input"
        type="text"
        value={title}
        placeholder="快速新增事件…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setPickerOpen(false)
          commit()
        }}
      />

      <button
        type="button"
        className="cal-quick-date-btn"
        aria-label="選擇日期"
        onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}
      >
        <span className="cal-quick-date-label">
          {date.slice(5).replace('-', '/')}
        </span>
        <input
          ref={dateRef}
          className="cal-quick-date-native"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </button>
    </div>
  )
}
