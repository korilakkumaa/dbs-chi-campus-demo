/**
 * Sanity checks for external-calendar privacy:
 * admin-visible personal notes must not export to another teacher's feed.
 *
 *   npm run verify:calendar-privacy
 *   npx tsx scripts/verify-calendar-external-privacy.ts
 */
import assert from 'node:assert/strict'
import {
  eventOwnedForExternalCalendar,
  filterEventsForExternalCalendar,
  shouldExportToExternalCalendar,
} from '../src/data/calendarIcs'
import type { CalendarEvent } from '../src/types'

function event(
  partial: Pick<CalendarEvent, 'id' | 'title' | 'audience'> &
    Partial<CalendarEvent>,
): CalendarEvent {
  return {
    date: '2026-09-08',
    kind: 'progress',
    createdBy: 'u-a',
    ...partial,
  }
}

/** Mirrors supabase/functions/_shared/calendar-events.ts eventVisibleToTeacher. */
function eventVisibleToTeacher(
  ev: CalendarEvent,
  ctx: { role: string; userId: string },
): boolean {
  const aud = ev.audience
  if (!aud || typeof aud !== 'object') return true
  if (aud.type === 'personal') return aud.ownerId === ctx.userId
  if (ctx.role === 'admin') return true
  if (aud.type === 'all') return true
  return false
}

const mine = event({
  id: 'mine',
  title: '我的備註',
  audience: { type: 'personal', ownerId: 'u-admin-teacher' },
  createdBy: 'u-admin-teacher',
})
const theirs = event({
  id: 'theirs',
  title: '別人的備註',
  audience: { type: 'personal', ownerId: 'u-other' },
  createdBy: 'u-other',
})
const shared = event({
  id: 'shared',
  title: '全校活動',
  audience: { type: 'all' },
  kind: 'event',
  createdBy: 'u-admin',
})
const colourOnly = event({
  id: 'colour',
  title: '',
  audience: { type: 'personal', ownerId: 'u-admin-teacher' },
  createdBy: 'u-admin-teacher',
})

assert.equal(eventOwnedForExternalCalendar(mine, 'u-admin-teacher'), true)
assert.equal(eventOwnedForExternalCalendar(theirs, 'u-admin-teacher'), false)
assert.equal(eventOwnedForExternalCalendar(shared, 'u-admin-teacher'), true)
assert.equal(shouldExportToExternalCalendar(colourOnly), false)

const exported = filterEventsForExternalCalendar(
  [mine, theirs, shared, colourOnly],
  'u-admin-teacher',
)
assert.deepEqual(
  exported.map((e) => e.id).sort(),
  ['mine', 'shared'],
  'admin sync must drop other teachers’ personal notes and colour-only marks',
)

const adminCtx = { role: 'admin', userId: 'u-twl' }
assert.equal(
  eventVisibleToTeacher(mine, { ...adminCtx, userId: 'u-admin-teacher' }),
  true,
)
assert.equal(eventVisibleToTeacher(theirs, adminCtx), false)
assert.equal(eventVisibleToTeacher(shared, adminCtx), true)

console.log('verify-calendar-external-privacy: ok')
