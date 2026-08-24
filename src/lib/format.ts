export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
