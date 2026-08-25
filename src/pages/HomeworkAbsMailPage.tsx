import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { useAuth } from '../context/AuthContext'
import {
  fetchHomeworkAbsEmailLogs,
  type HomeworkAbsEmailLog,
} from '../data/homeworkAbs'
import { officialStudentNo } from '../data/campusScoresYear'
import { latestTeacherWhitelistYear } from '../data/teacherWhitelist'
import { supabaseConfigured } from '../lib/supabase'

function statusLabel(status: HomeworkAbsEmailLog['status']) {
  if (status === 'sent') return '已寄出'
  if (status === 'failed') return '失敗'
  return '佇列中'
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HomeworkAbsMailPage() {
  const { user } = useAuth()
  const year = latestTeacherWhitelistYear()
  const [logs, setLogs] = useState<HomeworkAbsEmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabaseConfigured || !user) {
        setLoading(false)
        setError('尚未連線資料庫')
        return
      }
      setLoading(true)
      const data = await fetchHomeworkAbsEmailLogs({
        teacherId: user.role === 'admin' ? undefined : user.id,
        academicYearStart: year,
        limit: 300,
      })
      if (cancelled) return
      if (data == null) {
        setError('無法載入郵件紀錄')
        setLogs([])
      } else {
        setError(null)
        setLogs(data)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, year])

  const counts = useMemo(() => {
    let sent = 0
    let failed = 0
    let queued = 0
    for (const log of logs) {
      if (log.status === 'sent') sent++
      else if (log.status === 'failed') failed++
      else queued++
    }
    return { sent, failed, queued }
  }, [logs])

  return (
    <div className="page progress-page">
      <header className="page-header reveal-up">
        <div>
          <p className="homework-abs-back">
            <Link to="/progress">← 返回首頁</Link>
          </p>
          <h1>已處理郵件</h1>
          <p>欠交習作提醒的寄出紀錄；同一習作可從首頁右欄再次催交。</p>
        </div>
      </header>

      <GlassPanel className="reveal-up delay-1 homework-abs-mail-panel">
        <div className="homework-abs-mail-stats">
          <span>已寄出 {counts.sent}</span>
          <span>佇列中 {counts.queued}</span>
          <span>失敗 {counts.failed}</span>
        </div>

        {loading && <p className="empty-note">載入中…</p>}
        {!loading && error && <p className="empty-note">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="empty-note">尚無郵件紀錄。</p>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="homework-abs-mail-table-wrap">
            <table className="homework-abs-mail-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>班別</th>
                  <th>學生</th>
                  <th>習作</th>
                  <th>收件</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatWhen(log.sentAt || log.createdAt)}</td>
                    <td>{log.classLabel || log.groupLabel || '—'}</td>
                    <td>
                      {log.studentName || '—'}
                      {log.studentNo
                        ? `（${officialStudentNo(log.studentNo)}）`
                        : ''}
                    </td>
                    <td>{log.assignmentName}</td>
                    <td className="homework-abs-mail-email">{log.toEmail}</td>
                    <td>
                      <span
                        className={`homework-abs-status homework-abs-status-${log.status}`}
                      >
                        {statusLabel(log.status)}
                      </span>
                      {log.errorMessage ? (
                        <span className="homework-abs-mail-err">
                          {log.errorMessage}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
