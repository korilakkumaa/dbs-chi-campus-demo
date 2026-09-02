import type { Session } from '@supabase/supabase-js'
import type { CalendarEvent } from '../types'
import {
  deleteGoogleEventMapEntry,
  fetchGoogleEventMap,
  fetchGoogleCalendarSyncState,
  saveGoogleRefreshToken,
  upsertGoogleEventMap,
} from './supabaseCalendar'
import { supabase } from '../lib/supabase'
import { oauthRedirectTo } from '../lib/supabase'
import { eventSummary, googleEventSchedule } from './calendarIcs'

/** Must include openid + profile scopes or Supabase/Google sign-in breaks. */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export const GOOGLE_CALENDAR_AUTH_FLAG = 'campus-enable-google-sync'
export const GOOGLE_CALENDAR_AUTH_ATTEMPTED = 'campus-google-auth-attempted'

const REFRESH_KEY_PREFIX = 'campus-google-refresh:'

function refreshStorageKey(userId: string): string {
  return `${REFRESH_KEY_PREFIX}${userId}`
}

export function readStoredGoogleRefreshToken(userId: string): string | null {
  try {
    return localStorage.getItem(refreshStorageKey(userId))
  } catch {
    return null
  }
}

export function storeGoogleRefreshToken(
  userId: string,
  refreshToken: string | null | undefined,
): void {
  if (!refreshToken) return
  try {
    localStorage.setItem(refreshStorageKey(userId), refreshToken)
  } catch {
    /* ignore quota */
  }
}

export function persistGoogleTokensFromSession(
  userId: string,
  session: Session | null,
): void {
  if (!session) return
  storeGoogleRefreshToken(userId, session.provider_refresh_token)
  void saveGoogleRefreshToken(userId, session.provider_refresh_token)
}

export function parseGoogleApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; status?: string }
    }
    const msg = parsed.error?.message
    if (msg?.includes('insufficient') || msg?.includes('Insufficient')) {
      return 'Google 日曆權限不足（token 沒有 calendar.events）。'
    }
    if (msg) return msg
  } catch {
    /* not JSON */
  }
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw
}

export type GoogleCalendarProbe = {
  ok: boolean
  status: number
  detail: string
}

/** Probe with an API that calendar.events scope actually covers. */
export async function probeGoogleCalendarAccess(
  accessToken: string,
): Promise<GoogleCalendarProbe> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (res.ok) {
    return { ok: true, status: res.status, detail: '日曆 API 可用' }
  }
  const body = await res.text()
  return {
    ok: false,
    status: res.status,
    detail: parseGoogleApiError(body || res.statusText),
  }
}

export type GoogleCalendarDiagnostics = {
  authMethod: 'google' | 'password' | 'unknown'
  hasProviderToken: boolean
  hasRefreshToken: boolean
  probe: GoogleCalendarProbe | null
  hint: string
}

export async function getGoogleCalendarDiagnostics(
  userId: string,
  authMethod: 'google' | 'password' | null,
): Promise<GoogleCalendarDiagnostics> {
  const method = authMethod ?? 'unknown'
  if (method === 'password') {
    return {
      authMethod: 'password',
      hasProviderToken: false,
      hasRefreshToken: false,
      probe: null,
      hint: '你目前用密碼登入，沒有 Google 日曆 token。請改用 Google 登入，或直接用上方「訂閱連結」。',
    }
  }

  const { data } = (await supabase?.auth.getSession()) ?? { data: null }
  const token = data?.session?.provider_token ?? null
  const refresh =
    data?.session?.provider_refresh_token ??
    readStoredGoogleRefreshToken(userId)

  if (!token) {
    return {
      authMethod: method === 'google' ? 'google' : 'unknown',
      hasProviderToken: false,
      hasRefreshToken: Boolean(refresh),
      probe: null,
      hint: '沒有 Google access token。請按「授權 Google 日曆」並在 Google 頁面允許日曆存取。',
    }
  }

  const probe = await probeGoogleCalendarAccess(token)
  if (probe.ok) {
    return {
      authMethod: 'google',
      hasProviderToken: true,
      hasRefreshToken: Boolean(refresh),
      probe,
      hint: 'Google 日曆權限正常，可直接同步。',
    }
  }

  return {
    authMethod: 'google',
    hasProviderToken: true,
    hasRefreshToken: Boolean(refresh),
    probe,
    hint:
      probe.status === 403
        ? 'Token 沒有日曆權限。請到 myaccount.google.com → 第三方應用程式 → 移除本網站，再按「授權 Google 日曆」重新同意（須看到日曆權限）。並確認 Google Cloud 已啟用 Calendar API 且 OAuth 同意畫面已加入 calendar.events scope。'
        : `日曆 API 回應 ${probe.status}：${probe.detail}`,
  }
}

export async function requestGoogleCalendarAuth(): Promise<string | null> {
  if (!supabase) return 'Supabase 未設定'
  sessionStorage.setItem(GOOGLE_CALENDAR_AUTH_FLAG, '1')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: oauthRedirectTo(),
      scopes: GOOGLE_OAUTH_SCOPES,
      queryParams: {
        hd: 'dbs.edu.hk',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      },
    },
  })
  return error?.message ?? null
}

type GoogleEventBody = {
  summary: string
  description?: string
  start: { date?: string | null; dateTime?: string | null; timeZone?: string }
  end: { date?: string | null; dateTime?: string | null; timeZone?: string }
  location?: string
}

function eventToGoogleBody(event: CalendarEvent): GoogleEventBody {
  const summary = eventSummary(event)
  const schedule = googleEventSchedule(event)
  const body: GoogleEventBody = {
    summary,
    start: schedule.start,
    end: schedule.end,
  }

  if (event.lesson?.group) {
    body.location = event.lesson.group
    const parts = [event.lesson.subject, event.lesson.group].filter(Boolean)
    if (parts.length) body.description = parts.join(' · ')
  }

  return body
}

async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  body: GoogleEventBody,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    return { ok: false, error: parseGoogleApiError(err || res.statusText) }
  }
  const created = (await res.json()) as { id?: string }
  if (!created.id) return { ok: false, error: 'Google 未回傳事件 ID' }
  return { ok: true, id: created.id }
}

async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleId: string,
): Promise<void> {
  await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
    { method: 'DELETE' },
  )
}

async function googleFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export type GoogleSyncResult = {
  ok: boolean
  synced: number
  removed: number
  error?: string
}

/** Push visible campus events to the user's Google Calendar (upsert + prune). */
export async function syncEventsToGoogleCalendar(input: {
  userId: string
  accessToken: string
  calendarId: string
  events: CalendarEvent[]
}): Promise<GoogleSyncResult> {
  const { userId, accessToken, calendarId, events } = input
  const map = await fetchGoogleEventMap(userId)
  const visibleIds = new Set(events.map((e) => e.id))
  let synced = 0
  let removed = 0

  for (const event of events) {
    const body = eventToGoogleBody(event)
    let googleId = map.get(event.id)
    const encodedCal = encodeURIComponent(calendarId)

    if (googleId) {
      const res = await googleFetch(
        accessToken,
        `/calendars/${encodedCal}/events/${encodeURIComponent(googleId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      )
      if (res.ok) {
        synced += 1
        continue
      }
      if (res.status === 404) {
        map.delete(event.id)
        googleId = undefined
      } else if (res.status === 400) {
        await deleteGoogleEvent(accessToken, calendarId, googleId)
        await deleteGoogleEventMapEntry(userId, event.id)
        map.delete(event.id)
        googleId = undefined
      } else {
        const err = await res.text()
        return {
          ok: false,
          synced,
          removed,
          error: parseGoogleApiError(err || res.statusText),
        }
      }
    }

    const created = await createGoogleEvent(accessToken, calendarId, body)
    if (!created.ok) {
      return {
        ok: false,
        synced,
        removed,
        error: created.error,
      }
    }
    map.set(event.id, created.id)
    await upsertGoogleEventMap(userId, event.id, created.id)
    synced += 1
  }

  for (const [campusId, googleId] of map.entries()) {
    if (visibleIds.has(campusId)) continue
    const res = await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
      { method: 'DELETE' },
    )
    if (res.ok || res.status === 404 || res.status === 410) {
      await deleteGoogleEventMapEntry(userId, campusId)
      removed += 1
    }
  }

  return { ok: true, synced, removed }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.provider_token ?? null
}

export async function resolveGoogleCalendarId(userId: string): Promise<string> {
  const state = await fetchGoogleCalendarSyncState(userId)
  return state?.calendarId ?? 'primary'
}
