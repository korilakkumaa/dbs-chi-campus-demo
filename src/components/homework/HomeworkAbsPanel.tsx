import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  dismissHomeworkAbsItem,
  fetchHomeworkAbsDismissals,
  fetchHomeworkAbsItems,
  invokeSendHomeworkAbsEmail,
  itemMatchesTeacherClasses,
  queueHomeworkAbsEmail,
  type HomeworkAbsItem,
} from '../../data/homeworkAbs'
import {
  findWhitelistTeacherByEmail,
  latestTeacherWhitelistYear,
  teacherInitialFromUserId,
  teacherWhitelistForYear,
} from '../../data/teacherWhitelist'
import {
  studentEmailFromOfficialNo,
  studentEmailFromStoredNo,
} from '../../data/studentEmail'
import { officialStudentNo } from '../../data/campusScoresYear'
import { supabaseConfigured } from '../../lib/supabase'
import type { Student } from '../../types'

type Props = {
  students: Student[]
}

type RowState = {
  busy?: boolean
  message?: string
  gone?: boolean
}

function displayClassNumber(item: HomeworkAbsItem): string {
  if (item.classNumber != null) return String(item.classNumber)
  return '—'
}

function displayStudentNo(item: HomeworkAbsItem): string {
  if (!item.studentNo) return '—'
  return officialStudentNo(item.studentNo)
}

function enrichName(item: HomeworkAbsItem, students: Student[]): string {
  if (item.studentName.trim()) return item.studentName.trim()
  if (!item.studentNo) return '—'
  const hit = students.find((s) => s.id === item.studentNo)
  return hit?.name?.trim() || '—'
}

function resolveEmail(
  item: HomeworkAbsItem,
  students: Student[],
): string | null {
  if (item.studentNo) {
    const fromStored = studentEmailFromStoredNo(item.studentNo)
    if (fromStored) return fromStored
  }
  const byName = students.find((s) => {
    if (item.studentNo && s.id === item.studentNo) return true
    if (
      item.classNumber != null &&
      s.classNumber === item.classNumber &&
      item.classLabel &&
      s.classId.replace(/^c-/, '').toUpperCase() ===
        item.classLabel.replace(/\s+/g, '-').toUpperCase()
    ) {
      return true
    }
    return false
  })
  if (byName) return studentEmailFromStoredNo(byName.id)
  return studentEmailFromOfficialNo(item.studentNo)
}

export function HomeworkAbsPanel({ students }: Props) {
  const { user } = useAuth()
  const teachingYear = latestTeacherWhitelistYear()
  const [items, setItems] = useState<HomeworkAbsItem[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})

  const teacherClasses = useMemo(() => {
    if (!user) return [] as string[]
    const initial = teacherInitialFromUserId(user.id)
    const byInitial = initial
      ? teacherWhitelistForYear(teachingYear).find((t) => t.initial === initial)
      : undefined
    const byEmail = findWhitelistTeacherByEmail(user.username, teachingYear)
    const own = (byInitial ?? byEmail)?.classes ?? []
    if (own.length > 0) return own
    if (user.role === 'admin') {
      const all = new Set<string>()
      for (const t of teacherWhitelistForYear(teachingYear)) {
        for (const c of t.classes) all.add(c)
      }
      return [...all]
    }
    return []
  }, [user, teachingYear])

  const teacherInitial =
    (user && teacherInitialFromUserId(user.id)) ||
    (user
      ? findWhitelistTeacherByEmail(user.username, teachingYear)?.initial
      : null) ||
    ''

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabaseConfigured) {
        setLoading(false)
        setError('尚未連線資料庫')
        return
      }
      setLoading(true)
      const [abs, dismissals] = await Promise.all([
        fetchHomeworkAbsItems(teachingYear),
        fetchHomeworkAbsDismissals(teachingYear),
      ])
      if (cancelled) return
      if (abs == null || dismissals == null) {
        setError('無法載入欠交習作資料')
        setItems([])
        setDismissedIds(new Set())
      } else {
        setError(null)
        setItems(abs)
        setDismissedIds(new Set(dismissals.map((d) => d.absItemId)))
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [teachingYear])

  const visible = useMemo(() => {
    return items
      .filter((item) => !dismissedIds.has(item.id))
      .filter((item) => !rowState[item.id]?.gone)
      .filter((item) => itemMatchesTeacherClasses(item, teacherClasses))
      .sort((a, b) => {
        const g = a.groupLabel.localeCompare(b.groupLabel, 'zh-Hant')
        if (g !== 0) return g
        return a.assignmentName.localeCompare(b.assignmentName, 'zh-Hant')
      })
  }, [items, dismissedIds, rowState, teacherClasses])

  async function onTick(item: HomeworkAbsItem) {
    if (!user) return
    const email = resolveEmail(item, students)
    if (!email) {
      setRowState((prev) => ({
        ...prev,
        [item.id]: { message: '無法產生學生電郵（缺學生編號）' },
      }))
      return
    }
    setRowState((prev) => ({
      ...prev,
      [item.id]: { busy: true, message: '寄送中…' },
    }))
    const queued = await queueHomeworkAbsEmail({
      item,
      toEmail: email,
      teacherId: user.id,
      teacherInitial,
    })
    if (!queued.ok) {
      setRowState((prev) => ({
        ...prev,
        [item.id]: { message: queued.error },
      }))
      return
    }
    const sent = await invokeSendHomeworkAbsEmail(queued.log.id)
    if (!sent.ok) {
      setRowState((prev) => ({
        ...prev,
        [item.id]: {
          message: `已入佇列：${sent.error}`,
        },
      }))
      return
    }
    setRowState((prev) => ({
      ...prev,
      [item.id]: { message: `已寄出 → ${email}` },
    }))
  }

  async function onCross(item: HomeworkAbsItem) {
    if (!user) return
    setRowState((prev) => ({
      ...prev,
      [item.id]: { busy: true, message: '略過中…' },
    }))
    const result = await dismissHomeworkAbsItem({
      item,
      dismissedBy: user.id,
    })
    if (!result.ok) {
      setRowState((prev) => ({
        ...prev,
        [item.id]: { message: result.error },
      }))
      return
    }
    setDismissedIds((prev) => new Set(prev).add(item.id))
    setRowState((prev) => ({
      ...prev,
      [item.id]: { gone: true },
    }))
  }

  return (
    <div className="homework-abs-panel">
      <div className="homework-abs-head">
        <div>
          <h2 className="homework-abs-title">欠交習作</h2>
          <p className="homework-abs-sub">
            依白名單組別顯示 · 剔＝立刻提醒 · 交叉＝永久略過
          </p>
        </div>
        <Link className="homework-abs-mail-link" to="/progress/abs-mail">
          已處理郵件
        </Link>
      </div>

      {loading && <p className="homework-abs-empty">載入中…</p>}
      {!loading && error && <p className="homework-abs-empty">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="homework-abs-empty">目前沒有待處理的欠交記錄。</p>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="homework-abs-list">
          {visible.map((item) => {
            const state = rowState[item.id]
            return (
              <li key={item.id} className="homework-abs-item">
                <div className="homework-abs-meta">
                  <p className="homework-abs-line">
                    <span className="homework-abs-class">
                      {item.classLabel || item.groupLabel || '—'}
                    </span>
                    <span className="homework-abs-sep">·</span>
                    <span>學號 {displayClassNumber(item)}</span>
                    <span className="homework-abs-sep">·</span>
                    <span>{displayStudentNo(item)}</span>
                  </p>
                  <p className="homework-abs-name">
                    {enrichName(item, students)}
                  </p>
                  <p className="homework-abs-assignment">
                    {item.assignmentName}
                  </p>
                  {state?.message && (
                    <p className="homework-abs-msg">{state.message}</p>
                  )}
                </div>
                <div className="homework-abs-actions">
                  <button
                    type="button"
                    className="homework-abs-tick"
                    title="寄出提醒電郵"
                    disabled={state?.busy}
                    onClick={() => void onTick(item)}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="homework-abs-cross"
                    title="永久略過"
                    disabled={state?.busy}
                    onClick={() => void onCross(item)}
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
