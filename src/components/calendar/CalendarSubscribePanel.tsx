import { useCallback, useEffect, useState } from 'react'
import {
  feedUrlFromToken,
  webcalUrlFromFeedUrl,
} from '../../data/calendarIcs'
import {
  ensureCalendarFeedToken,
  fetchGoogleCalendarSyncState,
  rotateCalendarFeedToken,
  setGoogleCalendarSyncEnabled,
} from '../../data/supabaseCalendar'
import {
  getGoogleAccessToken,
  getGoogleCalendarDiagnostics,
  GOOGLE_CALENDAR_AUTH_FLAG,
  persistGoogleTokensFromSession,
  probeGoogleCalendarAccess,
  requestGoogleCalendarAuth,
  resolveGoogleCalendarId,
  syncEventsToGoogleCalendar,
  type GoogleCalendarDiagnostics,
} from '../../data/googleCalendarSync'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import type { CalendarEvent } from '../../types'
import { useAuth } from '../../context/AuthContext'

type Props = {
  calendarEvents: CalendarEvent[]
}

export function CalendarSubscribePanel({ calendarEvents }: Props) {
  const { user, authMethod } = useAuth()
  const [feedUrl, setFeedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [diagnostics, setDiagnostics] =
    useState<GoogleCalendarDiagnostics | null>(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined

  const refreshDiagnostics = useCallback(async () => {
    if (!user) return
    const diag = await getGoogleCalendarDiagnostics(user.id, authMethod)
    setDiagnostics(diag)
    return diag
  }, [user, authMethod])

  const loadFeed = useCallback(async () => {
    if (!user || !supabaseConfigured) return
    setLoading(true)
    setMessage(null)
    const { token, error } = await ensureCalendarFeedToken(user.id)
    if (token && supabaseUrl) {
      setFeedUrl(feedUrlFromToken(supabaseUrl, token))
    } else {
      setMessage(
        error
          ? `無法建立訂閱連結：${error}`
          : '無法建立訂閱連結（請確認 Supabase 已設定）。',
      )
    }
    const syncState = await fetchGoogleCalendarSyncState(user.id)
    setGoogleEnabled(syncState?.enabled ?? false)
    await refreshDiagnostics()
    setLoading(false)
  }, [user, supabaseUrl, refreshDiagnostics])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const authorizeGoogleCalendar = useCallback(async () => {
    if (authMethod === 'password') {
      setMessage(
        '密碼登入無法授權 Google 日曆。請先登出，改用 Google 登入後再按此按鈕。',
      )
      return
    }
    setMessage('正在開啟 Google 授權頁…請在下一頁允許「日曆」存取。')
    const err = await requestGoogleCalendarAuth()
    if (err) setMessage(err)
  }, [authMethod])

  useEffect(() => {
    if (!user || !supabase) return
    const pending = sessionStorage.getItem(GOOGLE_CALENDAR_AUTH_FLAG)
    if (!pending) return
    sessionStorage.removeItem(GOOGLE_CALENDAR_AUTH_FLAG)
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      persistGoogleTokensFromSession(user.id, data.session)
      const diag = await refreshDiagnostics()
      if (!diag?.probe?.ok) {
        setMessage(diag?.hint ?? 'Google 日曆權限仍未生效。')
        return
      }
      const ok = await setGoogleCalendarSyncEnabled(user.id, true)
      if (ok) {
        setGoogleEnabled(true)
        setMessage('已授權並開啟 Google 日曆同步。')
      }
    })()
  }, [user, refreshDiagnostics])

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(`已複製${label}`)
    } catch {
      setMessage(`請手動複製${label}`)
    }
  }

  const rotateFeed = async () => {
    if (!user) return
    setLoading(true)
    const { token, error } = await rotateCalendarFeedToken(user.id)
    if (token && supabaseUrl) {
      setFeedUrl(feedUrlFromToken(supabaseUrl, token))
      setMessage('已重新產生訂閱連結（舊連結將失效）。')
    } else if (error) {
      setMessage(`無法重新產生連結：${error}`)
    }
    setLoading(false)
  }

  const runGoogleSync = useCallback(async () => {
    if (!user || !googleEnabled || calendarEvents.length === 0) return
    const diag = await refreshDiagnostics()
    if (diag?.authMethod === 'password') {
      setMessage(diag.hint)
      return
    }
    const token = await getGoogleAccessToken()
    if (!token) {
      setMessage('沒有 Google token，請按「授權 Google 日曆」。')
      return
    }
    const probe = await probeGoogleCalendarAccess(token)
    if (!probe.ok) {
      setMessage(diag?.hint ?? probe.detail)
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
      setMessage(`Google 同步失敗：${result.error ?? '未知錯誤'}`)
      await refreshDiagnostics()
    } else if (result.synced > 0 || result.removed > 0) {
      setMessage(
        `Google 日曆已更新（${result.synced} 項${result.removed ? `，移除 ${result.removed} 項` : ''}）。`,
      )
    }
    setGoogleBusy(false)
  }, [user, googleEnabled, calendarEvents, refreshDiagnostics])

  useEffect(() => {
    if (!googleEnabled || googleBusy) return
    const timer = window.setTimeout(() => {
      void runGoogleSync()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [googleEnabled, calendarEvents, runGoogleSync, googleBusy])

  const toggleGoogle = async () => {
    if (!user) return
    if (!googleEnabled) {
      const diag = await refreshDiagnostics()
      if (diag?.authMethod === 'password') {
        setMessage(diag.hint)
        return
      }
      const token = await getGoogleAccessToken()
      const probe = token ? await probeGoogleCalendarAccess(token) : null
      if (!token || !probe?.ok) {
        setMessage(
          diag?.hint ??
            '需要 Google 日曆權限。即將開啟授權頁，請允許「查看與編輯日曆活動」。',
        )
        await authorizeGoogleCalendar()
        return
      }
      const ok = await setGoogleCalendarSyncEnabled(user.id, true)
      if (ok) {
        setGoogleEnabled(true)
        setMessage('已開啟 Google 日曆同步。')
      }
      return
    }
    const ok = await setGoogleCalendarSyncEnabled(user.id, false)
    if (ok) {
      setGoogleEnabled(false)
      setMessage('已關閉 Google 日曆同步。')
    }
  }

  if (!user || !supabaseConfigured) return null

  const webcal = feedUrl ? webcalUrlFromFeedUrl(feedUrl) : null

  return (
    <section className="cal-subscribe-panel">
      <h3 className="cal-subscribe-title">同步至外部日曆</h3>
      <p className="cal-subscribe-desc">
        依你的教師身分過濾個人版校曆（含私人備註）。訂閱後 Google／Apple
        日曆會自動更新（通常每數小時）。
      </p>

      {loading && <p className="cal-subscribe-msg">載入中…</p>}
      {message && <p className="cal-subscribe-msg">{message}</p>}

      {feedUrl && (
        <div className="cal-subscribe-actions">
          <button
            type="button"
            className="cal-subscribe-btn"
            onClick={() => void copyText(feedUrl, ' HTTPS 訂閱連結')}
          >
            複製訂閱連結（Google，推薦）
          </button>
          {webcal && (
            <button
              type="button"
              className="cal-subscribe-btn"
              onClick={() => void copyText(webcal, ' webcal 連結')}
            >
              複製訂閱連結（Apple）
            </button>
          )}
          <a
            className="cal-subscribe-btn cal-subscribe-link"
            href={webcal ?? feedUrl}
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

      <div className="cal-subscribe-google">
        <button
          type="button"
          className={`cal-subscribe-btn${googleEnabled ? ' active' : ''}`}
          disabled={googleBusy}
          onClick={() => void toggleGoogle()}
        >
          {googleEnabled
            ? googleBusy
              ? 'Google 同步中…'
              : '關閉 Google 直接同步'
            : '開啟 Google 直接同步（進階）'}
        </button>
        <button
          type="button"
          className="cal-subscribe-btn"
          onClick={() => void authorizeGoogleCalendar()}
        >
          授權 Google 日曆
        </button>
        <p className="cal-subscribe-hint">
          {authMethod === 'password'
            ? '你正在用密碼登入：Google 直接同步不可用。請登出後改用 Google 登入，或只用上方訂閱連結。'
            : '直接同步需 Google 登入 + 日曆授權 + Google Cloud 啟用 Calendar API。若仍失敗，建議只用訂閱連結。'}
        </p>
        {diagnostics && (
          <details className="cal-subscribe-debug">
            <summary>診斷資訊</summary>
            <ul>
              <li>登入方式：{diagnostics.authMethod}</li>
              <li>有 provider token：{diagnostics.hasProviderToken ? '是' : '否'}</li>
              <li>有 refresh token：{diagnostics.hasRefreshToken ? '是' : '否'}</li>
              {diagnostics.probe && (
                <li>
                  日曆 API：{diagnostics.probe.ok ? 'OK' : `${diagnostics.probe.status} ${diagnostics.probe.detail}`}
                </li>
              )}
              <li>{diagnostics.hint}</li>
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
