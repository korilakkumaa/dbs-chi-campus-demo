/** Deep-link helpers for admin → 測考範圍 (HashRouter-safe paths). */

export function examScopePath(opts: { year: number }): string {
  const params = new URLSearchParams()
  params.set('year', String(opts.year))
  return `/resources/scope?${params.toString()}`
}
