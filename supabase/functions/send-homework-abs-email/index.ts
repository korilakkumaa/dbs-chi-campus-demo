import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type LogRow = {
  id: string
  to_email: string
  student_name: string
  class_label: string
  assignment_name: string
  teacher_initial: string
  status: string
}

function buildEmail(input: {
  studentName: string
  classLabel: string
  assignmentName: string
  teacherInitial: string
}) {
  const who = input.studentName || '同學'
  const cls = input.classLabel ? `（${input.classLabel}）` : ''
  return {
    subject: `【中文科習作提醒】請盡快補交：${input.assignmentName}`,
    text: [
      `${who}${cls} 你好：`,
      '',
      `系統記錄顯示你尚未完成／欠交習作「${input.assignmentName}」。`,
      '請盡快補交。如已交妥，可向任教老師確認。',
      '',
      input.teacherInitial
        ? `任教老師：${input.teacherInitial}`
        : '中國語文科',
      '',
      '（此為系統自動提醒電郵）',
    ].join('\n'),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { logId } = (await req.json()) as { logId?: string }
    if (!logId) {
      return new Response(JSON.stringify({ ok: false, error: 'logId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from =
      Deno.env.get('HOMEWORK_ABS_FROM_EMAIL') ||
      'Campus CMS <onboarding@resend.dev>'

    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'RESEND_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data, error } = await admin
      .from('homework_abs_email_logs')
      .select(
        'id, to_email, student_name, class_label, assignment_name, teacher_initial, status',
      )
      .eq('id', logId)
      .maybeSingle()

    if (error || !data) {
      return new Response(
        JSON.stringify({ ok: false, error: error?.message || 'log not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const row = data as LogRow
    if (row.status === 'sent') {
      return new Response(JSON.stringify({ ok: true, status: 'sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mail = buildEmail({
      studentName: row.student_name,
      classLabel: row.class_label,
      assignmentName: row.assignment_name,
      teacherInitial: row.teacher_initial,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [row.to_email],
        subject: mail.subject,
        text: mail.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      await admin
        .from('homework_abs_email_logs')
        .update({
          status: 'failed',
          error_message: `Resend ${res.status}: ${body}`.slice(0, 500),
        })
        .eq('id', logId)
      return new Response(
        JSON.stringify({ ok: false, error: `Resend ${res.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    await admin
      .from('homework_abs_email_logs')
      .update({
        status: 'sent',
        error_message: '',
        sent_at: new Date().toISOString(),
      })
      .eq('id', logId)

    return new Response(JSON.stringify({ ok: true, status: 'sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
