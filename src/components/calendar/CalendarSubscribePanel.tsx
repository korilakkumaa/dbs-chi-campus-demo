import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  feedUrlFromToken,
  webcalUrlFromFeedUrl,
} from '../../data/calendarIcs'
import {
  ensureCalendarFeedToken,
  rotateCalendarFeedToken,
  setGoogleCalendarSyncEnabled,
} from '../../data/supabaseCalendar'
import {
  getGoogleAccessToken,
  getGoogleCalendarDiagnostics,
  GOOGLE_CALENDAR_AUTH_FLAG,
  GOOGLE_CALENDAR_AUTH_ATTEMPTED,
  persistGoogleTokensFromSession,
  probeGoogleCalendarAccess,
  requestGoogleCalendarAuth,
  resolveGoogleCalendarId,
  syncEventsToGoogleCalendar,
} from '../../data/googleCalendarSync'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import type { CalendarEvent } from '../../types'
import { useAuth } from '../../context/AuthContext'

type Props = {
  calendarEvents: CalendarEvent[]
}

type PanelMessage = {
  text: string
  tone: 'info' | 'success' | 'error'
}

function formatSyncTime(date: Date): string {
  return date.toLocaleTimeString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CalendarSubscribePanel({ calendarEvents }: Props) {
  const { user, authMethod } = useAuth()
  const [feedUrl, setFeedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<PanelMessage | null>(null)
  const [googleReady, setGoogleReady] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleJustSynced, setGoogleJustSynced] = useState(false)
  const [googleNeedsAuth, setGoogleNeedsAuth] = useState(false)
  const [lastGoogleSyncAt, setLastGoogleSyncAt] = useState<Date | null>(null)
  const googleSetupStarted = useRef(false)
  const googleSuccessTimer = useRef<number | null>(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const eventCount = calendarEvents.length
  const usesGoogleLogin = authMethod === 'google'

  const ensureGoogleSync = useCallback(async () => {
    if (!user || authMethod === 'password') {
      setGoogleReady(false)
      setGoogleNeedsAuth(false)
      return
    }

    const token = await getGoogleAccessToken()
    if (!token) {
      setGoogleReady(false)
      setGoogleNeedsAuth(true)
      return
    }

    const probe = await probeGoogleCalendarAccess(token)
    if (!probe.ok) {
      setGoogleReady(false)
      setGoogleNeedsAuth(true)
      return
    }

    await setGoogleCalendarSyncEnabled(user.id, true)
    setGoogleReady(true)
    setGoogleNeedsAuth(false)
  }, [user, authMethod])

  const loadFeed = useCallback(async () => {
    if (!user || !supabaseConfigured) return
    setLoading(true)
    setMessage(null)
    const { token, error } = await ensureCalendarFeedToken(user.id)
    if (token && supabaseUrl) {
      setFeedUrl(feedUrlFromToken(supabaseUrl, token))
    } else {
      setMessage({
        tone: 'error',
        text: error
          ? `無法建立 Apple 訂閱連結：${error}`
          : '無法建立 Apple 訂閱連結（請確認 Supabase 已設定）。',
      })
    }
    await ensureGoogleSync()
    if (supabase) {
      const { data } = await supabase.auth.getSession()
      persistGoogleTokensFromSession(user.id, data.session)
    }
    setLoading(false)
  }, [user, supabaseUrl, ensureGoogleSync])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const authorizeGoogleCalendar = useCallback(async () => {
    if (authMethod === 'password') return
    sessionStorage.removeItem(GOOGLE_CALENDAR_AUTH_ATTEMPTED)
    setMessage({
      tone: 'info',
      text: '正在開啟 Google 授權頁…請允許「日曆」存取，完成後會自動同步。',
    })
    const err = await requestGoogleCalendarAuth()
    if (err) setMessage({ tone: 'error', text: err })
  }, [authMethod])

  useEffect(() => {
    if (!user || !supabase || !usesGoogleLogin) return
    if (googleSetupStarted.current || googleReady || loading) return
    if (!googleNeedsAuth) return
    if (sessionStorage.getItem(GOOGLE_CALENDAR_AUTH_ATTEMPTED)) return
    googleSetupStarted.current = true
    sessionStorage.setItem(GOOGLE_CALENDAR_AUTH_ATTEMPTED, '1')
    void authorizeGoogleCalendar()
  }, [
    user,
    usesGoogleLogin,
    googleReady,
    googleNeedsAuth,
    loading,
    authorizeGoogleCalendar,
  ])

  useEffect(() => {
    if (!user || !supabase) return
    const pending = sessionStorage.getItem(GOOGLE_CALENDAR_AUTH_FLAG)
    if (!pending) return
    sessionStorage.removeItem(GOOGLE_CALENDAR_AUTH_FLAG)
    sessionStorage.removeItem(GOOGLE_CALENDAR_AUTH_ATTEMPTED)
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      persistGoogleTokensFromSession(user.id, data.session)
      const diag = await getGoogleCalendarDiagnostics(user.id, authMethod)
      if (!diag?.probe?.ok) {
        setMessage({
          tone: 'error',
          text: diag?.hint ?? 'Google 日曆權限仍未生效。',
        })
        setGoogleNeedsAuth(true)
        return
      }
      await setGoogleCalendarSyncEnabled(user.id, true)
      setGoogleReady(true)
      setGoogleNeedsAuth(false)
      setMessage({ tone: 'success', text: 'Google 日曆已授權，正在同步…' })
    })()
  }, [user, authMethod])

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ tone: 'success', text: `已複製${label}` })
    } catch {
      setMessage({ tone: 'info', text: `請手動複製${label}` })
    }
  }

  useEffect(() => {
    return () => {
      if (googleSuccessTimer.current != null) {
        window.clearTimeout(googleSuccessTimer.current)
      }
    }
  }, [])

  const markGoogleSyncSuccess = useCallback(() => {
    setGoogleJustSynced(true)
    if (googleSuccessTimer.current != null) {
      window.clearTimeout(googleSuccessTimer.current)
    }
    googleSuccessTimer.current = window.setTimeout(() => {
      setGoogleJustSynced(false)
      googleSuccessTimer.current = null
    }, 2400)
  }, [])

  const rotateFeed = async () => {
    if (!user) return
    setLoading(true)
    const { token, error } = await rotateCalendarFeedToken(user.id)
    if (token && supabaseUrl) {
      setFeedUrl(feedUrlFromToken(supabaseUrl, token))
      setMessage({
        tone: 'success',
        text: '已重新產生 Apple 訂閱連結（舊連結將失效）。',
      })
    } else if (error) {
      setMessage({ tone: 'error', text: `無法重新產生連結：${error}` })
    }
    setLoading(false)
  }

  const runGoogleSync = useCallback(async () => {
    if (!user || !googleReady || calendarEvents.length === 0) return
    const token = await getGoogleAccessToken()
    if (!token) {
      setGoogleNeedsAuth(true)
      return
    }
    const probe = await probeGoogleCalendarAccess(token)
    if (!probe.ok) {
      setGoogleReady(false)
      setGoogleNeedsAuth(true)
      return
    }
    setGoogleBusy(true)
    const calendarId = await resolveGoogleCalendarId(user.id)
    const result = await syncEventsToGoogleCalendar({
      userId: user.id,
      accessToken: token,
      calendarId,
      events: calendarEvents,
    })
    if (!result.ok) {
      setMessage({
        tone: 'error',
        text: `Google 同步失敗：${result.error ?? '未知錯誤'}`,
      })
    } else {
      setLastGoogleSyncAt(new Date())
      markGoogleSyncSuccess()
      if (result.synced > 0 || result.removed > 0) {
        setMessage({
          tone: 'success',
          text: `Google 日曆已更新（${result.synced} 項${result.removed ? `，移除 ${result.removed} 項` : ''}）。`,
        })
      }
    }
    setGoogleBusy(false)
  }, [user, googleReady, calendarEvents, markGoogleSyncSuccess])

  useEffect(() => {
    if (!googleReady || googleBusy) return
    const timer = window.setTimeout(() => {
      void runGoogleSync()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [googleReady, calendarEvents, runGoogleSync, googleBusy])

  const googleStatus = useMemo(() => {
    if (!usesGoogleLogin) return '請改用 Google 登入'
    if (googleBusy) return '同步中…'
    if (googleNeedsAuth) return '待授權'
    if (lastGoogleSyncAt) return `已同步（${formatSyncTime(lastGoogleSyncAt)}）`
    if (googleReady) return '已就緒'
    return loading ? '載入中…' : '準備中'
  }, [
    usesGoogleLogin,
    googleBusy,
    googleNeedsAuth,
    lastGoogleSyncAt,
    googleReady,
    loading,
  ])

  const appleStatus = feedUrl ? '訂閱連結已就緒' : loading ? '載入中…' : '尚未就緒'

  if (!user || !supabaseConfigured) return null

  const webcal = feedUrl ? webcalUrlFromFeedUrl(feedUrl) : null

  const googleCardClass = [
    'cal-subscribe-card',
    'google',
    googleBusy ? 'syncing' : '',
    googleJustSynced ? 'synced' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const googleStatusClass = [
    'cal-subscribe-status',
    googleBusy ? 'syncing' : '',
    googleJustSynced ? 'synced' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <details
      className={`cal-subscribe-panel${googleBusy ? ' google-syncing' : ''}${googleJustSynced ? ' google-synced' : ''}`}
    >
      <summary className="cal-subscribe-summary">
        <span className="cal-subscribe-summary-title">同步至外部日曆</span>
        <span className="cal-subscribe-summary-meta">
          {usesGoogleLogin && (googleBusy || googleJustSynced) && (
            <span
              className={`cal-subscribe-summary-sync${googleBusy ? ' syncing' : ' synced'}`}
              aria-hidden
            >
              {googleBusy ? (
                <svg viewBox="0 0 24 24" className="cal-subscribe-sync-icon">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="cal-subscribe-sync-icon">
                  <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </span>
          )}
          {eventCount} 項 · Google {googleStatus} · Apple {appleStatus}
        </span>
        <span className="cal-subscribe-chevron" aria-hidden>
          ›
        </span>
      </summary>

      <div className="cal-subscribe-body">
        <p className="cal-subscribe-lead">
          依你的教師身分過濾個人版校曆（含私人備註）。Google
          日曆會自動推送；Apple 日曆請訂閱一次即可定期更新。
        </p>

        {loading && (
          <p className="cal-subscribe-msg info" role="status">
            載入中…
          </p>
        )}
        {message && (
          <p
            className={`cal-subscribe-msg ${message.tone}`}
            role={message.tone === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}

        <div className="cal-subscribe-platforms">
          <section className={googleCardClass}>
            <div className="cal-subscribe-card-head">
              <h4 className="cal-subscribe-card-title">Google 日曆</h4>
              <span
                className={googleStatusClass}
                role="status"
                aria-live="polite"
              >
                {(googleBusy || googleJustSynced) && (
                  <span className="cal-subscribe-status-icon" aria-hidden>
                    {googleBusy ? (
                      <svg viewBox="0 0 24 24" className="cal-subscribe-sync-icon">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="cal-subscribe-sync-icon">
                        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </span>
                )}
                {googleStatus}
              </span>
            </div>
            {googleBusy && (
              <div className="cal-subscribe-sync-bar" aria-hidden>
                <span className="cal-subscribe-sync-bar-fill" />
              </div>
            )}
            <p className="cal-subscribe-card-desc">
              {usesGoogleLogin
                ? '變更後會自動推送到你的 Google 主日曆；即使關閉網站，後端亦每 3 小時同步一次。'
                : '請登出後改用 Google 登入，才能自動同步 Google 日曆。'}
            </p>
            {usesGoogleLogin && googleNeedsAuth && (
              <div className="cal-subscribe-actions">
                <button
                  type="button"
                  className="cal-subscribe-btn primary"
                  onClick={() => void authorizeGoogleCalendar()}
                >
                  完成 Google 授權
                </button>
              </div>
            )}
          </section>

          <section className="cal-subscribe-card apple">
            <div className="cal-subscribe-card-head">
              <h4 className="cal-subscribe-card-title">Apple 日曆</h4>
              <span className="cal-subscribe-status">{appleStatus}</span>
            </div>
            <p className="cal-subscribe-card-desc">
              日曆 App → 檔案 → 新增日曆訂閱 → 貼上連結（通常每數小時更新）。
            </p>
            {webcal && (
              <div className="cal-subscribe-actions">
                <button
                  type="button"
                  className="cal-subscribe-btn primary"
                  onClick={() => void copyText(webcal, ' Apple 訂閱連結')}
                >
                  複製訂閱連結
                </button>
                <a
                  className="cal-subscribe-btn cal-subscribe-link"
                  href={webcal}
                >
                  開啟訂閱
                </a>
                <button
                  type="button"
                  className="cal-subscribe-btn subtle"
                  onClick={() => void rotateFeed()}
                >
                  重新產生連結
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </details>
  )
}
