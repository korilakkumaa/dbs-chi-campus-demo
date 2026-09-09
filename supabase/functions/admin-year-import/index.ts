import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const ADMIN_INITIALS = ['TWL', 'LKL', 'YLN', 'HT']

type ImportKind =
  | 'teacher_whitelist'
  | 'student_roster'
  | 'chinese_streaming'
  | 'school_calendar'
  | 'assessment_duty'
  | 'dept_duty'
  | 'semester_scores'
  | 'grade_deadlines'

type Body = {
  kind?: ImportKind
  startYear?: number
  payload?: unknown
  replaceMode?: boolean
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

function gradeFromClassName(name: string): number {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ ok: false, error: 'Missing Authorization' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user?.email) {
      return json({ ok: false, error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const email = user.email.toLowerCase()

    // Admin check: email on whitelist with ADMIN_INITIALS, else known seed locals.
    const { data: wlYears } = await admin
      .from('teacher_whitelist_years')
      .select('teachers')
    let isAdmin = false
    for (const row of wlYears ?? []) {
      const teachers = Array.isArray(row.teachers) ? row.teachers : []
      for (const t of teachers) {
        if (
          String(t?.email ?? '').toLowerCase() === email &&
          ADMIN_INITIALS.includes(String(t?.initial ?? '').toUpperCase())
        ) {
          isAdmin = true
          break
        }
      }
      if (isAdmin) break
    }
    if (!isAdmin) {
      const local = email.split('@')[0] ?? ''
      isAdmin = ['dbstwl', 'dbslkl', 'dbsyln', 'dbsht'].includes(local)
    }
    if (!isAdmin) {
      return json({ ok: false, kind: null, upserted: 0, error: '僅管理員可匯入' }, 403)
    }

    const body = (await req.json()) as Body
    const kind = body.kind
    const startYear = Number(body.startYear)
    const replaceMode = Boolean(body.replaceMode)
    if (!kind || !Number.isFinite(startYear)) {
      return json({ ok: false, error: 'kind / startYear required' }, 400)
    }

    const updatedBy = user.id

    if (kind === 'teacher_whitelist') {
      const teachers = Array.isArray(body.payload) ? body.payload : []
      const { error } = await admin.from('teacher_whitelist_years').upsert(
        {
          start_year: startYear,
          teachers,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'start_year' },
      )
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: teachers.length })
    }

    if (kind === 'grade_deadlines') {
      const deadlines = Array.isArray(body.payload) ? body.payload : []
      const { error } = await admin.from('grade_deadlines_years').upsert(
        {
          start_year: startYear,
          deadlines,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'start_year' },
      )
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: deadlines.length })
    }

    if (kind === 'assessment_duty') {
      const duty = body.payload as Record<string, unknown>
      const { error } = await admin.from('assessment_duty_years').upsert(
        {
          start_year: startYear,
          label: duty.label ?? '',
          title: duty.title ?? '',
          category_labels: duty.categoryLabels ?? {},
          category_short_labels: duty.categoryShortLabels ?? {},
          grade_matrix: duty.gradeMatrix ?? [],
          ec_appendix: duty.ecAppendix ?? [],
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'start_year' },
      )
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: 1 })
    }

    if (kind === 'dept_duty') {
      const duty = body.payload as Record<string, unknown>
      const items = Array.isArray(duty.items) ? duty.items : []
      const { error } = await admin.from('dept_duty_years').upsert(
        {
          start_year: startYear,
          label: duty.label ?? '',
          source: duty.source ?? 'csv-import',
          items,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'start_year' },
      )
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: items.length })
    }

    if (kind === 'student_roster') {
      const rows = Array.isArray(body.payload) ? body.payload : []
      const classMap = new Map<string, { id: string; name: string; grade: number }>()
      for (const r of rows) {
        const name = String(r.class_name ?? '')
        const id = classNameToId(name)
        classMap.set(id, { id, name, grade: gradeFromClassName(name) })
      }
      const classes = [...classMap.values()]
      if (classes.length) {
        const { error } = await admin.from('classes').upsert(classes, { onConflict: 'id' })
        if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      }
      const students = rows.map((r) => ({
        student_no: r.student_no,
        class_id: classNameToId(String(r.class_name ?? '')),
        class_number: Number(r.class_number) || 0,
        name_zh: r.name_zh ?? '',
        name_en: r.name_en ?? '',
        house: r.house ?? '',
        french: Boolean(r.french),
        roster_remarks: r.remarks ?? '',
        academic_year_start: startYear,
      }))
      const { error } = await admin.from('students').upsert(students, {
        onConflict: 'student_no',
      })
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: students.length })
    }

    if (kind === 'chinese_streaming') {
      const rows = Array.isArray(body.payload) ? body.payload : []
      let upserted = 0
      for (const r of rows) {
        const { error } = await admin
          .from('students')
          .update({
            teaching_group: r.teaching_group,
            french: Boolean(r.french),
          })
          .eq('student_no', r.student_no)
        if (error) return json({ ok: false, kind, upserted, error: error.message }, 500)
        upserted++
      }
      return json({ ok: true, kind, upserted })
    }

    if (kind === 'semester_scores') {
      const rows = Array.isArray(body.payload) ? body.payload : []
      const payload = rows.map((r) => ({
        student_no: r.student_no,
        academic_year_start: startYear,
        semester: r.semester,
        daily: r.daily,
        reading: r.reading,
        writing: r.writing,
        components: {},
      }))
      const { error } = await admin.from('semester_records').upsert(payload, {
        onConflict: 'student_no,academic_year_start,semester',
      })
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: payload.length })
    }

    if (kind === 'school_calendar') {
      const rows = Array.isArray(body.payload) ? body.payload : []
      if (replaceMode) {
        await admin
          .from('campus_calendar_events')
          .delete()
          .eq('school_year_start', startYear)
          .like('id', `csv-${startYear}-%`)
      }
      const events = rows.map((r, i) => ({
        id: `csv-${startYear}-${r.date}-${i}`.slice(0, 180),
        date: r.date,
        title: r.notes ? `${r.title}（${r.notes}）` : r.title,
        kind: r.kind || 'event',
        school_year_start: startYear,
        created_by: 'csv-import',
        audience: { type: 'all' },
        lesson: null,
        deleted: false,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await admin.from('campus_calendar_events').upsert(events, {
        onConflict: 'id',
      })
      if (error) return json({ ok: false, kind, upserted: 0, error: error.message }, 500)
      return json({ ok: true, kind, upserted: events.length })
    }

    return json({ ok: false, error: `Unknown kind: ${kind}` }, 400)
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})
