import { TOWER_EXCEL, SOLDIER_BY_ID } from './excelData'
import type { HeroCategory, HeroKindId } from './types'

export interface HeroKind {
  id: HeroKindId
  name: string
  baseHp: number
  baseAtk: number
  category: HeroCategory
  /** Visual scale for drawing. */
  scale: number
  tint: string | null
}

function heroKindTint(category: HeroCategory) {
  // Keep drawing tint subtle; actual damage uses Excel matchup table.
  if (category === '文') return 'rgba(36, 64, 110, 0.22)'
  if (category === '詩') return 'rgba(140, 88, 36, 0.18)'
  if (category === '詞') return 'rgba(80, 120, 60, 0.18)'
  return null
}

export const HERO_KIND_CATALOG: Record<HeroKindId, HeroKind> =
  Object.fromEntries(
    TOWER_EXCEL.soldiers.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        baseHp: s.baseHp,
        baseAtk: s.baseAtk,
        category: s.category,
        scale: s.effectiveClimb,
        tint: heroKindTint(s.category),
      },
    ]),
  ) as Record<HeroKindId, HeroKind>

function getSoldier(kind: HeroKindId) {
  return SOLDIER_BY_ID[kind]
}

/**
 * Effective hero level in the Excel sheet:
 * - Our UI stores `heroLevel` starting from 0.
 * - Excel formulas appear to use L starting from 1 (base stats at L=1).
 */
function excelLevel(heroLevel: number) {
  return Math.max(0, Math.floor(heroLevel)) + 1
}

function speedBonusAtLevel(L: number) {
  // Speed(L) = Base + 0.01 × (accelerate primes ≤ L)
  // Primes table already stores the cumulative bonus.
  const primes = TOWER_EXCEL.accPrimes as ReadonlyArray<{ prime: number; bonus: number }>
  let lo = 0
  let hi = primes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = primes[mid]!.prime
    if (v <= L) lo = mid + 1
    else hi = mid - 1
  }
  if (hi < 0) return 0
  return primes[hi]!.bonus
}

// Lanczos approximation for log(Gamma(z)).
// Sufficient for our use case: computing log products with large L.
function logGamma(z: number): number {
  const p = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    // Reflection formula for better stability.
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  z -= 1
  let x = 0.99999999999980993
  for (let i = 0; i < p.length; i += 1) {
    x += p[i]! / (z + i + 1)
  }
  const t = z + p.length - 0.5
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  )
}

function statAtLevel(base: number, g0: number, heroLevel: number) {
  const L = excelLevel(heroLevel)
  if (L <= 1) return base
  if (base <= 0) return 0

  // Excel: each level up:
  // g_eff(k) = g0 / (1 + (k-1)/D)
  // Excel appears to apply g_eff(L-1) as the multiplier when advancing from (L-1) -> L.
  // With STAT_1 = base, overall:
  //   STAT_L = base × Π_{t=1..L-1} (1 + g0 / (1 + (t-1)/D))
  //
  // Let m=t-1 => m=0..L-2:
  //   term(m) = (m + D*(1+g0)) / (m + D)
  //   => product = Π_{m=0..L-2} (m + A)/(m + B)
  //
  // Gamma identity:
  //   Π_{m=0..n} (m + A) = Γ(A+n+1)/Γ(A)
  //   Π_{m=0..n} (m + B) = Γ(B+n+1)/Γ(B)
  const D = TOWER_EXCEL.D
  const A = D * (1 + g0)
  const B = D
  const m = L - 1 // n+1 where n=L-2

  const logProduct =
    logGamma(A + m) - logGamma(A) + logGamma(B) - logGamma(B + m)
  const logValue = Math.log(base) + logProduct
  if (!Number.isFinite(logValue)) return Number.MAX_VALUE
  // Avoid Infinity from exp overflow.
  if (logValue > 700) return Number.MAX_VALUE
  return Math.exp(logValue)
}

export function heroHpFor(kind: HeroKindId, heroLevel: number) {
  const meta = getSoldier(kind)
  return Math.round(statAtLevel(meta.baseHp, meta.g0Hp, heroLevel))
}

export function heroAtkFor(kind: HeroKindId, heroLevel: number) {
  const meta = getSoldier(kind)
  return Math.max(1, Math.round(statAtLevel(meta.baseAtk, meta.g0Atk, heroLevel)))
}

export function heroMoveSpeed(kind: HeroKindId, heroLevel: number) {
  const meta = getSoldier(kind)
  const L = excelLevel(heroLevel)
  return meta.baseSpeed + speedBonusAtLevel(L)
}

export function heroSpawnSeconds(kind: HeroKindId, heroLevel: number) {
  const meta = getSoldier(kind)
  const speed = heroMoveSpeed(kind, heroLevel)
  if (meta.cooldownBase <= 0) return Infinity
  // Excel cooldown time scales inversely with speed.
  return Math.max(0.2, meta.cooldownBase / Math.max(0.01, speed))
}

export function heroUpgradeCost(kind: HeroKindId, heroLevel: number) {
  const meta = getSoldier(kind)
  if (meta.upgradeCostBase <= 0 || meta.g0UpgradeCost <= 0) return 0
  const cost = statAtLevel(meta.upgradeCostBase, meta.g0UpgradeCost, heroLevel)
  return Math.max(1, Math.round(cost))
}

export function heroUpgradeBatchCost(kind: HeroKindId, heroLevel: number, levels: number) {
  let total = 0
  const stepN = Math.max(0, Math.floor(levels))
  const current = Math.max(0, Math.floor(heroLevel))
  for (let step = 0; step < stepN; step += 1) {
    const cost = heroUpgradeCost(kind, current + step)
    total += cost
  }
  return total
}

export function heroKind() {
  // Legacy hook: tower engine uses this for "upgrade default hero".
  // For Excel integration, pick the first soldier in roster order.
  const first = TOWER_EXCEL.soldiers[0]
  return HERO_KIND_CATALOG[first.id]!
}

export function heroMatchupMultiplier(attacker: HeroKindId, defenderCategory: HeroCategory) {
  const atkCat = getSoldier(attacker).category
  return TOWER_EXCEL.matchup[atkCat]?.[defenderCategory] ?? 1
}

