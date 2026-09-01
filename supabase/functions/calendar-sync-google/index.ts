import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  dbRowToOverlayRow,
  visibleEventsForUser,
} from '../_shared/calendar-events.ts'
import {
  refreshGoogleAccessToken,
  syncEventsToGoogleCalendar,
} from '../_shared/google-calendar-sync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type SyncUserRow = {
  user_id: string
  calendar_id: string
  provider_refresh_token: string
}

function authorizeCron(req: Request): boolean {
  const secret = Deno.env.get('CALENDAR_SYNC_CRON_SECRET')
  if (!secret) return false
  const auth = req.headers.get('Authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const header = req.headers.get('x-cron-secret') ?? ''
  return bearer === secret || header === secret
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  if (!authorizeCron(req)) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!supabaseUrl || !serviceKey) {
      return new Response('Server misconfigured', {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: syncRows, error: syncError } = await admin
      .from('google_calendar_sync')
      .select('user_id, calendar_id, provider_refresh_token')
      .eq('enabled', true)
      .not('provider_refresh_token', 'is', null)

    if (syncError) {
      return new Response(syncError.message, {
        status: 500,
        headers: corsHeaders,
      })
    }

    const users = (syncRows ?? []).filter(
      (row): row is SyncUserRow =>
        Boolean(row.user_id && row.provider_refresh_token),
    )

    const { data: dbRows, error: dbError } = await admin
      .from('campus_calendar_events')
      .select('*')

    if (dbError) {
      return new Response(dbError.message, {
        status: 500,
        headers: corsHeaders,
      })
    }

    const overlayRows = (dbRows ?? []).map((raw) =>
      dbRowToOverlayRow(raw as Record<string, unknown>),
    )

    const results: Array<{
      userId: string
      ok: boolean
      synced?: number
      removed?: number
      error?: string
    }> = []

    for (const user of users) {
      const userId = user.user_id
      const calendarId = user.calendar_id || 'primary'
      const events = visibleEventsForUser(userId, overlayRows)

      const tokenResult = await refreshGoogleAccessToken({
        refreshToken: user.provider_refresh_token,
        clientId,
        clientSecret,
      })

      if ('error' in tokenResult) {
        await admin
          .from('google_calendar_sync')
          .update({
            last_sync_error: tokenResult.error.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        results.push({ userId, ok: false, error: tokenResult.error })
        continue
      }

      const { data: mapRows } = await admin
        .from('google_calendar_event_map')
        .select('campus_event_id, google_event_id')
        .eq('user_id', userId)

      const eventMap = new Map<string, string>()
      for (const row of mapRows ?? []) {
        eventMap.set(
          row.campus_event_id as string,
          row.google_event_id as string,
        )
      }

      const syncResult = await syncEventsToGoogleCalendar({
        accessToken: tokenResult.accessToken,
        calendarId,
        events,
        eventMap,
        onMapUpsert: async (campusEventId, googleEventId) => {
          await admin.from('google_calendar_event_map').upsert(
            {
              user_id: userId,
              campus_event_id: campusEventId,
              google_event_id: googleEventId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,campus_event_id' },
          )
        },
        onMapDelete: async (campusEventId) => {
          await admin
            .from('google_calendar_event_map')
            .delete()
            .eq('user_id', userId)
            .eq('campus_event_id', campusEventId)
        },
      })

      if (!syncResult.ok) {
        await admin
          .from('google_calendar_sync')
          .update({
            last_sync_error: (syncResult.error ?? 'sync failed').slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        results.push({
          userId,
          ok: false,
          synced: syncResult.synced,
          removed: syncResult.removed,
          error: syncResult.error,
        })
        continue
      }

      await admin
        .from('google_calendar_sync')
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      results.push({
        userId,
        ok: true,
        synced: syncResult.synced,
        removed: syncResult.removed,
      })
    }

    const summary = {
      ok: true,
      users: users.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
