import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import bundle from '../_shared/calendar-bundle.json' with { type: 'json' }
import {
  dbRowToOverlayRow,
  eventSummary,
  eventVisibleToTeacher,
  mergeSeedWithOverlay,
  teacherContext,
  type CalendarEvent,
} from '../_shared/calendar-events.ts'
import { buildIcsCalendar } from '../_shared/calendar-ics.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type OverlayRow = {
  event: CalendarEvent
  deleted: boolean
  updatedAt?: string
}

function mergeWithUpdatedAt(
  seed: CalendarEvent[],
  rows: OverlayRow[],
): Array<{ event: CalendarEvent; updatedAt?: string }> {
  const updatedAtById = new Map<string, string>()
  for (const row of rows) {
    if (!row.deleted && row.updatedAt) {
      updatedAtById.set(row.event.id, row.updatedAt)
    }
  }
  const merged = mergeSeedWithOverlay(seed, rows)
  return merged.map((event) => ({
    event,
    updatedAt: updatedAtById.get(event.id),
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')?.trim()
    if (!token) {
      return new Response('Missing token', { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response('Server misconfigured', {
        status: 500,
        headers: corsHeaders,
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: tokenRow, error: tokenError } = await admin
      .from('calendar_feed_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenRow?.user_id) {
      return new Response('Invalid token', { status: 403, headers: corsHeaders })
    }

    const userId = tokenRow.user_id as string
    const role = userId === 'u-admin' ? 'admin' : 'teacher'
    const ctx = teacherContext(userId, role)

    const { data: dbRows, error: dbError } = await admin
      .from('campus_calendar_events')
      .select('*')

    if (dbError) {
      return new Response(dbError.message, { status: 500, headers: corsHeaders })
    }

    const overlayRows: OverlayRow[] = (dbRows ?? []).map((raw) => {
      const row = dbRowToOverlayRow(raw as Record<string, unknown>)
      const updatedAt =
        typeof raw.updated_at === 'string' ? raw.updated_at : undefined
      return { ...row, updatedAt }
    })

    const merged = mergeWithUpdatedAt(bundle.seed as CalendarEvent[], overlayRows)
    const visible = merged
      .filter(({ event }) => eventVisibleToTeacher(event, ctx))
      .sort(
        (a, b) =>
          a.event.date.localeCompare(b.event.date) ||
          eventSummary(a.event).localeCompare(eventSummary(b.event), 'zh-Hant'),
      )

    const calendarName =
      ctx.role === 'admin'
        ? 'Campus CMS 校曆'
        : `Campus CMS · ${ctx.name}`
    const ics = buildIcsCalendar(visible, calendarName)

    return new Response(ics, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(message, { status: 500, headers: corsHeaders })
  }
})
