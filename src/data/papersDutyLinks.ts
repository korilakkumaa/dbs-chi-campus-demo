/** Deep-link helpers for admin → 出卷 editor (HashRouter-safe paths). */

export function papersDutyPath(opts: {
  year: number
  edit?: boolean
}): string {
  const params = new URLSearchParams()
  params.set('year', String(opts.year))
  if (opts.edit) params.set('edit', '1')
  return `/resources/papers?${params.toString()}`
}
