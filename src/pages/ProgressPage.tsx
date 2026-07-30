import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { average } from '../data/mockData'
import {
  gradeLabel,
  gradeNumberFromClassName,
  GRADE_LEVELS,
} from '../data/teacherWhitelist'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { SortHeader } from '../components/SortHeader'
import type { GradeDeadline } from '../types'

const BAND_COLORS = {
  green: '#355447',
  blue: '#6a93a8',
  yellow: '#c4a035',
  red: '#c45a3a',
} as const

type BandTone = keyof typeof BAND_COLORS

const BAND_DEFS: {
  label: string
  range: string
  min: number
  tone: BandTone
}[] = [
  { label: '良好', range: '70–100%', min: 70, tone: 'green' },
  { label: '一般', range: '40–70%', min: 40, tone: 'blue' },
  { label: '偏弱', range: '10–40%', min: 10, tone: 'yellow' },
  { label: '危急', range: '0–10%', min: 0, tone: 'red' },
]

type SortKey = 'classNumber' | 'className' | 'progress' | 'correctRate'
type SortDir = 'asc' | 'desc'

type BandMetric = 'progress' | 'correctRate'

type BandFilter = {
  metric: BandMetric
  tone: BandTone
}

function bandBounds(tone: BandTone) {
  const i = BAND_DEFS.findIndex((b) => b.tone === tone)
  const band = BAND_DEFS[i]
  const max = i === 0 ? 101 : BAND_DEFS[i - 1].min
  return { min: band.min, max, label: band.label, range: band.range }
}

function valueInBand(value: number, tone: BandTone) {
  const { min, max } = bandBounds(tone)
  return value >= min && value < max
}

function buildBands(values: number[]) {
  return BAND_DEFS.map((band, i, arr) => {
    const max = i === 0 ? 101 : arr[i - 1].min
    const count = values.filter((v) => v >= band.min && v < max).length
    return { ...band, count }
  })
}

function buildRingSegments(
  bands: ReturnType<typeof buildBands>,
  total: number,
  circumference: number,
) {
  let offset = 0
  return bands.map((b) => {
    const length = total === 0 ? 0 : (b.count / total) * circumference
    const segment = {
      ...b,
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
      color: BAND_COLORS[b.tone],
    }
    offset += length
    return segment
  })
}

function BandRingChart({
  title,
  ariaLabel,
  values,
  metric,
  activeTone,
  onSelectBand,
}: {
  title: string
  ariaLabel: string
  values: number[]
  metric: BandMetric
  activeTone: BandTone | null
  onSelectBand: (metric: BandMetric, tone: BandTone) => void
}) {
  const bands = buildBands(values)
  const total = values.length
  const radius = 54
  const stroke = 18
  const circumference = 2 * Math.PI * radius
  const ringSegments = buildRingSegments(bands, total, circumference)
  const [tip, setTip] = useState<string | null>(null)

  const selectBand = (tone: BandTone) => {
    onSelectBand(metric, tone)
  }

  return (
    <section className="band-section">
      <h2>{title}</h2>
      <div className="ring-chart">
        <div
          className="ring-visual"
          onMouseLeave={() => setTip(null)}
        >
          <svg viewBox="0 0 140 140" role="group" aria-label={ariaLabel}>
            <circle
              className="ring-track"
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth={stroke}
              pointerEvents="none"
            />
            {total === 0
              ? null
              : ringSegments.map((seg) =>
                  seg.count === 0 ? null : (
                    <circle
                      key={seg.label}
                      className={`ring-segment${
                        activeTone === seg.tone ? ' is-active' : ''
                      }${
                        activeTone && activeTone !== seg.tone
                          ? ' is-dimmed'
                          : ''
                      }`}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                      strokeLinecap="butt"
                      transform="rotate(-90 70 70)"
                      pointerEvents="stroke"
                      role="button"
                      tabIndex={0}
                      aria-pressed={activeTone === seg.tone}
                      aria-label={`${seg.label} ${seg.range}，${seg.count} 位`}
                      onMouseEnter={() =>
                        setTip(`${seg.label}：${seg.range}`)
                      }
                      onClick={() => selectBand(seg.tone)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          selectBand(seg.tone)
                        }
                      }}
                    />
                  ),
                )}
          </svg>
          <div className="ring-center">
            <p className="ring-center-value">{total}</p>
            <p className="ring-center-label">位學生</p>
          </div>
          {tip && <div className="ring-tip">{tip}</div>}
        </div>
        <ul className="ring-legend">
          {bands.map((b) => {
            const pct = total === 0 ? 0 : Math.round((b.count / total) * 100)
            const isActive = activeTone === b.tone
            return (
              <li key={b.label}>
                <button
                  type="button"
                  className={`ring-legend-item tone-${b.tone}${
                    isActive ? ' is-active' : ''
                  }`}
                  aria-pressed={isActive}
                  disabled={b.count === 0}
                  onMouseEnter={() => setTip(`${b.label}：${b.range}`)}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => selectBand(b.tone)}
                >
                  <span className="ring-swatch" aria-hidden />
                  <div>
                    <p className="band-label">{b.label}</p>
                    <p className="band-count">
                      {b.count} 位 · {pct}%
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function formatDue(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
}

function daysUntil(iso: string): number | null {
  if (!iso) return null
  const due = new Date(`${iso}T23:59:59`)
  if (Number.isNaN(due.getTime())) return null
  const now = new Date()
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyClass(iso: string): string {
  const days = daysUntil(iso)
  if (days == null) return ''
  if (days < 0) return ' overdue'
  if (days <= 7) return ' soon'
  return ''
}

const DONE_HIDE_MS = 24 * 60 * 60 * 1000

type DoneMap = Record<string, number>

function loadDoneMap(storageKey: string): DoneMap {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    const now = Date.now()
    let map: DoneMap = {}

    if (Array.isArray(parsed)) {
      // Legacy: string[] without timestamps — start the 1-day window now.
      for (const key of parsed) {
        if (typeof key === 'string') map[key] = now
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          map[key] = value
        }
      }
    }

    map = Object.fromEntries(
      Object.entries(map).filter(([, at]) => now - at < DONE_HIDE_MS),
    )
    localStorage.setItem(storageKey, JSON.stringify(map))
    return map
  } catch {
    return {}
  }
}

function saveDoneMap(storageKey: string, map: DoneMap) {
  localStorage.setItem(storageKey, JSON.stringify(map))
}

function DeadlineReminders({ items }: { items: GradeDeadline[] }) {
  const { user } = useAuth()
  const storageKey = `campus-deadline-done:${user?.id ?? 'guest'}`

  const [doneMap, setDoneMap] = useState<DoneMap>(() => loadDoneMap(storageKey))

  useEffect(() => {
    setDoneMap(loadDoneMap(storageKey))
  }, [storageKey])

  if (items.length === 0) {
    return (
      <div className="deadline-reminders empty">
        <p>目前沒有適用的截止日期提醒。</p>
      </div>
    )
  }

  const now = Date.now()
  const rows = items
    .flatMap((d) => {
      const list: {
        key: string
        grade: number
        title: string
        due: string
      }[] = []
      if (d.readingDue) {
        list.push({
          key: `${d.grade}-reading`,
          grade: d.grade,
          title: '閱讀報告',
          due: d.readingDue,
        })
      }
      if (d.activityDue) {
        list.push({
          key: `${d.grade}-activity`,
          grade: d.grade,
          title: d.activityTitle.trim() || '活動',
          due: d.activityDue,
        })
      }
      return list
    })
    .filter((r) => {
      const completedAt = doneMap[r.key]
      if (completedAt == null) return true
      return now - completedAt < DONE_HIDE_MS
    })

  rows.sort((a, b) => {
    const aDone = doneMap[a.key] != null ? 1 : 0
    const bDone = doneMap[b.key] != null ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return a.due.localeCompare(b.due) || a.grade - b.grade
  })

  const toggleDone = (key: string) => {
    setDoneMap((prev) => {
      const next = { ...prev }
      if (next[key] != null) {
        delete next[key]
      } else {
        next[key] = Date.now()
      }
      const pruned = Object.fromEntries(
        Object.entries(next).filter(([, at]) => Date.now() - at < DONE_HIDE_MS),
      )
      saveDoneMap(storageKey, pruned)
      return pruned
    })
  }

  if (rows.length === 0) {
    return (
      <div className="deadline-reminders empty">
        <p>目前沒有適用的截止日期提醒。</p>
      </div>
    )
  }

  return (
    <div className="deadline-reminders">
      <p className="deadline-reminders-label">截止日期提醒</p>
      <ul className="deadline-list">
        {rows.map((r) => {
          const done = doneMap[r.key] != null
          const inputId = `deadline-check-${r.key}`
          return (
            <li
              key={r.key}
              className={`deadline-item${urgencyClass(r.due)}${done ? ' done' : ''}`}
            >
              <div className="deadline-check">
                <input
                  id={inputId}
                  type="checkbox"
                  className="task-checkbox"
                  checked={done}
                  onChange={() => toggleDone(r.key)}
                />
                <label className="checkbox-label" htmlFor={inputId}>
                  <span className="checkbox-box" aria-hidden>
                    <span className="checkbox-fill" />
                    <span className="success-ripple" />
                    <span className="checkmark">
                      <svg className="check-icon" viewBox="0 0 24 24">
                        <path d="M9.00001 16.17L4.83001 12L3.41001 13.41L9.00001 19L21 7.00001L19.59 5.59001L9.00001 16.17Z" />
                      </svg>
                    </span>
                  </span>
                  <span className="sr-only">
                    {done ? '取消完成' : '標記完成'}
                    {gradeLabel(r.grade)}
                    {r.title}
                  </span>
                </label>
              </div>
              <span className="deadline-grade">{gradeLabel(r.grade)}</span>
              <span className="deadline-title">{r.title}</span>
              <span className="deadline-date">{formatDue(r.due)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ProgressPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    selectedStudents,
    filteredStudents,
    getClassName,
    searchQuery,
    relevantDeadlines,
    taughtGradeNumbers,
    classes,
    students,
  } = useCampus()
  const list = searchQuery.trim() ? filteredStudents : selectedStudents
  const avgProgress = average(list.map((s) => s.progress))
  const avgCorrectRate = average(list.map((s) => s.correctRate))

  const openStudent = (studentId: string) => {
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [bandFilter, setBandFilter] = useState<BandFilter | null>(null)

  const bandScopedList = useMemo(() => {
    if (!bandFilter) return list
    return list.filter((s) =>
      valueInBand(s[bandFilter.metric], bandFilter.tone),
    )
  }, [list, bandFilter])

  const sortedList = useMemo(() => {
    const rows = [...bandScopedList]
    const factor = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'classNumber') cmp = a.classNumber - b.classNumber
      else if (sortKey === 'className') {
        cmp =
          getClassName(a.classId).localeCompare(getClassName(b.classId), 'en', {
            numeric: true,
          }) || a.classNumber - b.classNumber
      } else cmp = a[sortKey] - b[sortKey]
      if (cmp === 0) cmp = a.classNumber - b.classNumber
      return cmp * factor
    })
    return rows
  }, [bandScopedList, sortKey, sortDir, getClassName])

  const onSort = (key: SortKey, nextDir: SortDir) => {
    setSortKey(key)
    setSortDir(nextDir)
  }

  const onSelectBand = (metric: BandMetric, tone: BandTone) => {
    setBandFilter((prev) =>
      prev?.metric === metric && prev.tone === tone
        ? null
        : { metric, tone },
    )
  }

  const filterCaption = useMemo(() => {
    if (!bandFilter) return null
    const bounds = bandBounds(bandFilter.tone)
    const metricLabel =
      bandFilter.metric === 'progress' ? '進度' : '答對率'
    return `${metricLabel} · ${bounds.label}（${bounds.range}）`
  }, [bandFilter])

  const gradeOptions =
    user?.role === 'admin'
      ? [...GRADE_LEVELS]
      : taughtGradeNumbers.length > 0
        ? taughtGradeNumbers
        : [...GRADE_LEVELS]

  const [gradeForAvg, setGradeForAvg] = useState<number>(gradeOptions[0] ?? 7)

  useEffect(() => {
    if (!gradeOptions.includes(gradeForAvg)) {
      setGradeForAvg(gradeOptions[0] ?? 7)
    }
  }, [gradeOptions.join(','), gradeForAvg])

  useEffect(() => {
    setBandFilter(null)
  }, [searchQuery, list.map((s) => s.id).join('|')])

  const gradeAvgProgress = useMemo(() => {
    const gradeClassIds = new Set(
      classes
        .filter((c) => gradeNumberFromClassName(c.name) === gradeForAvg)
        .map((c) => c.id),
    )
    const cohort = students.filter((s) => gradeClassIds.has(s.classId))
    return average(cohort.map((s) => s.progress))
  }, [classes, students, gradeForAvg])

  return (
    <div className="page progress-page">
      <header className="page-header reveal-up">
        <h1>進度</h1>
        <p>已選班級的學期成長概況。</p>
      </header>

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">檢視中的學生</p>
          <p className="metric-value">{list.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">平均進度</p>
          <p className="metric-value">{avgProgress}%</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">答對率</p>
          <p className="metric-value">{avgCorrectRate}%</p>
        </GlassPanel>
        <GlassPanel className="metric metric-grade-avg">
          <div className="metric-label-row">
            <p className="metric-label">級平均進度</p>
            <label className="grade-avg-picker">
              <span className="sr-only">選擇年級</span>
              <select
                value={gradeForAvg}
                onChange={(e) => setGradeForAvg(Number(e.target.value))}
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="metric-value">{gradeAvgProgress}%</p>
        </GlassPanel>
      </div>

      <div className="split-stage reveal-up delay-2">
        <GlassPanel className="band-panel">
          <DeadlineReminders items={relevantDeadlines} />
          <BandRingChart
            title="班級進度概況"
            ariaLabel="班級進度環形圖"
            metric="progress"
            values={list.map((s) => s.progress)}
            activeTone={
              bandFilter?.metric === 'progress' ? bandFilter.tone : null
            }
            onSelectBand={onSelectBand}
          />
          <BandRingChart
            title="班級答題概況"
            ariaLabel="班級答題環形圖"
            metric="correctRate"
            values={list.map((s) => s.correctRate)}
            activeTone={
              bandFilter?.metric === 'correctRate' ? bandFilter.tone : null
            }
            onSelectBand={onSelectBand}
          />
        </GlassPanel>

        <GlassPanel className="table-panel">
          <div className="table-panel-head">
            <h2>{bandFilter ? '篩選結果' : '學生進度'}</h2>
            {filterCaption && (
              <div className="band-filter-chip">
                <span>{filterCaption}</span>
                <button
                  type="button"
                  className="band-filter-clear"
                  onClick={() => setBandFilter(null)}
                >
                  清除
                </button>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table className="progress-roster-table">
              <thead>
                <tr>
                  <SortHeader
                    label="學號"
                    column="classNumber"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <th>姓名</th>
                  <SortHeader
                    label="班級"
                    column="className"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <SortHeader
                    label="進度"
                    column="progress"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <SortHeader
                    label="答對率"
                    column="correctRate"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      此區間暫無學生
                    </td>
                  </tr>
                ) : (
                  sortedList.map((s) => (
                    <tr
                      key={s.id}
                      className="table-row-link"
                      tabIndex={0}
                      role="link"
                      aria-label={`開啟 ${s.name} 的個人檔案`}
                      onClick={() => openStudent(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openStudent(s.id)
                        }
                      }}
                    >
                      <td>{String(s.classNumber).padStart(2, '0')}</td>
                      <td>{s.name}</td>
                      <td>{getClassName(s.classId)}</td>
                      <td>
                        <div className="inline-meter">
                          <span className="inline-meter-track">
                            <span
                              className="inline-fill"
                              style={{ width: `${s.progress}%` }}
                            />
                          </span>
                          <em>{s.progress}%</em>
                        </div>
                      </td>
                      <td>{s.correctRate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
