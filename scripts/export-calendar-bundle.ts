import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

async function main() {
  const server = await createServer({ server: { middlewareMode: true } })
  try {
    const calendarEvents = await server.ssrLoadModule('/src/data/calendarEvents.ts')
    const whitelist = await server.ssrLoadModule('/src/data/teacherWhitelist.ts')
    const staff = await server.ssrLoadModule('/src/data/staffUsers.ts')

    const { buildSeedCalendarEvents } = calendarEvents as {
      buildSeedCalendarEvents: () => unknown[]
    }
    const {
      TEACHER_WHITELIST_2526,
      TEACHER_WHITELIST_2627,
      latestTeacherWhitelistYear,
      teacherUserIdFromInitial,
    } = whitelist as {
      TEACHER_WHITELIST_2526: Array<{
        initial: string
        name: string
        email: string
        classes: string[]
      }>
      TEACHER_WHITELIST_2627: Array<{
        initial: string
        name: string
        email: string
        classes: string[]
      }>
      latestTeacherWhitelistYear: () => number
      teacherUserIdFromInitial: (initial: string) => string
    }
    const { ADMIN_INITIALS } = staff as {
      ADMIN_INITIALS: readonly string[]
    }

    const mapWhitelist = (
      rows: Array<{
        initial: string
        name: string
        email: string
        classes: string[]
      }>,
    ) =>
      rows.map((t) => ({
        userId: teacherUserIdFromInitial(t.initial),
        initial: t.initial,
        name: t.name,
        email: t.email,
        classes: t.classes,
      }))

    const adminUserIds = [
      'u-admin',
      ...ADMIN_INITIALS.map((initial) => teacherUserIdFromInitial(initial)),
    ]

    const bundle = {
      seed: buildSeedCalendarEvents(),
      whitelistByYear: {
        2025: mapWhitelist(TEACHER_WHITELIST_2526),
        2026: mapWhitelist(TEACHER_WHITELIST_2627),
      },
      latestWhitelistYear: latestTeacherWhitelistYear(),
      adminUserIds,
    }

    const outDir = 'supabase/functions/_shared'
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      `${outDir}/calendar-bundle.json`,
      JSON.stringify(bundle),
      'utf8',
    )
    console.log(
      `Wrote ${(bundle.seed as unknown[]).length} seed events to ${outDir}/calendar-bundle.json`,
    )
  } finally {
    await server.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
