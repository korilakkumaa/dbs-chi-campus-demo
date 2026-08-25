import type { SupabaseClient } from '@supabase/supabase-js'

type LogRow = {
  id: string
  to_email: string
  student_name: string
  class_label: string
  assignment_name: string
  teacher_initial: string
  status: string
}

export type ProcessMailResult = {
  sent: number
  failed: number
  skipped: number
}

async function sendViaResend(input: {
  to: string
  subject: string
  text: string
  from: string
  apiKey: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `Resend ${res.status}: ${body}` }
  }
  return { ok: true }
}

export function buildAbsReminderEmail(input: {
  studentName: string
  classLabel: string
  assignmentName: string
  teacherInitial: string
}): { subject: string; text: string } {
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

export async function processQueuedHomeworkAbsEmails(
  client: SupabaseClient,
  options?: { logId?: string; limit?: number },
): Promise<ProcessMailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.HOMEWORK_ABS_FROM_EMAIL?.trim() ||
    'Campus CMS <onboarding@resend.dev>'

  let query = client
    .from('homework_abs_email_logs')
    .select(
      'id, to_email, student_name, class_label, assignment_name, teacher_initial, status',
    )
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(options?.limit ?? 50)
  if (options?.logId) {
    query = client
      .from('homework_abs_email_logs')
      .select(
        'id, to_email, student_name, class_label, assignment_name, teacher_initial, status',
      )
      .eq('id', options.logId)
      .limit(1)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as LogRow[]
  let sent = 0
  let failed = 0
  let skipped = 0

  if (!apiKey) {
    for (const row of rows) {
      await client
        .from('homework_abs_email_logs')
        .update({
          status: 'failed',
          error_message: 'RESEND_API_KEY not configured',
        })
        .eq('id', row.id)
      failed++
    }
    return { sent, failed, skipped }
  }

  for (const row of rows) {
    if (row.status !== 'queued' && options?.logId == null) {
      skipped++
      continue
    }
    const mail = buildAbsReminderEmail({
      studentName: row.student_name,
      classLabel: row.class_label,
      assignmentName: row.assignment_name,
      teacherInitial: row.teacher_initial,
    })
    const result = await sendViaResend({
      to: row.to_email,
      subject: mail.subject,
      text: mail.text,
      from,
      apiKey,
    })
    if (result.ok) {
      await client
        .from('homework_abs_email_logs')
        .update({
          status: 'sent',
          error_message: '',
          sent_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      sent++
    } else {
      await client
        .from('homework_abs_email_logs')
        .update({
          status: 'failed',
          error_message: result.error.slice(0, 500),
        })
        .eq('id', row.id)
      failed++
    }
  }

  return { sent, failed, skipped }
}
