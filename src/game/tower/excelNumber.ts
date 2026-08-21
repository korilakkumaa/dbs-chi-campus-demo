const UNITS: Array<{ value: number; suffix: string }> = [
  // base
  { value: 1, suffix: '' },
  { value: 1e3, suffix: 'K' },
  { value: 1e6, suffix: 'M' },
  { value: 1e9, suffix: 'B' },
  { value: 1e12, suffix: 'T' },
  // a..z : 1e15..1e90 (step 1e3)
  { value: 1e15, suffix: 'a' },
  { value: 1e18, suffix: 'b' },
  { value: 1e21, suffix: 'c' },
  { value: 1e24, suffix: 'd' },
  { value: 1e27, suffix: 'e' },
  { value: 1e30, suffix: 'f' },
  { value: 1e33, suffix: 'g' },
  { value: 1e36, suffix: 'h' },
  { value: 1e39, suffix: 'i' },
  { value: 1e42, suffix: 'j' },
  { value: 1e45, suffix: 'k' },
  { value: 1e48, suffix: 'l' },
  { value: 1e51, suffix: 'm' },
  { value: 1e54, suffix: 'n' },
  { value: 1e57, suffix: 'o' },
  { value: 1e60, suffix: 'p' },
  { value: 1e63, suffix: 'q' },
  { value: 1e66, suffix: 'r' },
  { value: 1e69, suffix: 's' },
  { value: 1e72, suffix: 't' },
  { value: 1e75, suffix: 'u' },
  { value: 1e78, suffix: 'v' },
  { value: 1e81, suffix: 'w' },
  { value: 1e84, suffix: 'x' },
  { value: 1e87, suffix: 'y' },
  { value: 1e90, suffix: 'z' },
]

function roundToSigFigs(n: number, sig: number) {
  if (n === 0) return 0
  if (!Number.isFinite(n)) return n
  const abs = Math.abs(n)
  const digits = Math.floor(Math.log10(abs))
  const factor = Math.pow(10, sig - 1 - digits)
  return Math.round(n * factor) / factor
}

/**
 * Excel-like shorthand:
 * - Round to first 6 significant figures.
 * - Show highest 2 units (e.g. 1,050,000 -> 1M50K).
 * - If number is an exact 1,000-multiple below 1,000,000, keep raw (e.g. 1000 -> "1000").
 */
export function formatExcelNumber(value: number, maxSig = 6) {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'

  const sign = value < 0 ? '-' : ''
  const rounded = roundToSigFigs(Math.abs(value), maxSig)

  // Keep "1000" style raw for the first unit boundary, per your example.
  if (rounded < 1e6 && Math.round(rounded) % 1e3 === 0) {
    return sign + String(Math.round(rounded))
  }

  // Find major unit (highest unit <= rounded).
  let majorIdx = 0
  for (let i = 1; i < UNITS.length; i += 1) {
    if (rounded >= UNITS[i]!.value) majorIdx = i
  }

  const major = Math.floor(rounded / UNITS[majorIdx]!.value)
  const minorUnitIdx = Math.max(0, majorIdx - 1)
  const minorUnit = UNITS[minorUnitIdx]!.value
  const minor = Math.floor((rounded - major * UNITS[majorIdx]!.value) / minorUnit)

  const majorSuffix = UNITS[majorIdx]!.suffix
  const minorSuffix = UNITS[minorUnitIdx]!.suffix

  if (minor === 0) return sign + `${major}${majorSuffix}`

  // When minorSuffix is '', format as plain remainder (e.g. 1K200).
  if (minorSuffix === '') return sign + `${major}${majorSuffix}${minor}`
  return sign + `${major}${majorSuffix}${minor}${minorSuffix}`
}

