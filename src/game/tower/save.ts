import { initialSave } from './combat'
import { FLY_Y_BASE } from './config'
import { TOWER_EXCEL } from './excelData'
import type { HeroKindId, SpeedRate, TowerSave } from './types'

const STORAGE_PREFIX = 'tower-save-'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

function isSpeed(value: unknown): value is SpeedRate {
  return value === 1 || value === 2 || value === 3
}

function parseSave(raw: unknown, fallbackBest: number): TowerSave | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.version !== 4) return null
  const nums = ['bestFloor', 'hp', 'maxHp', 'atk', 'def', 'gold', 'exp', 'level', 'unspent', 'nextSoldierId'] as const
  for (const key of nums) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) return null
  }
  if (!isSpeed(data.speed)) return null
  const maxHp = Math.max(1, Math.floor(data.maxHp as number))
  if (!Array.isArray(data.floors) || !Array.isArray(data.soldiers)) return null

  const levelsRaw =
    data.heroLevels && typeof data.heroLevels === 'object'
      ? (data.heroLevels as Record<string, unknown>)
      : null

  return {
    version: 4,
    bestFloor: Math.max(1, fallbackBest, Math.floor(data.bestFloor as number)),
    hp: Math.max(0, Math.min(maxHp, Math.floor(data.hp as number))),
    maxHp,
    atk: Math.max(1, Math.floor(data.atk as number)),
    def: Math.max(0, Math.floor(data.def as number)),
    gold: Math.max(0, Math.floor(data.gold as number)),
    exp: Math.max(0, Math.floor(data.exp as number)),
    level: Math.max(1, Math.floor(data.level as number)),
    unspent: Math.max(0, Math.floor(data.unspent as number)),
    speed: data.speed,
    heroLevels: {
      ...(TOWER_EXCEL.soldiers.reduce((acc, s) => {
        acc[s.id] =
          levelsRaw && typeof levelsRaw[s.id] === 'number'
            ? Math.max(0, Math.floor(levelsRaw[s.id] as number))
            : 0
        return acc
      }, {} as Record<HeroKindId, number>)),
    },
    nextSoldierId: Math.max(1, Math.floor(data.nextSoldierId as number)),
    floors: data.floors as TowerSave['floors'],
    soldiers: (data.soldiers as TowerSave['soldiers']).map((s) => ({
      ...s,
      frame: typeof s.frame === 'number' ? s.frame : 0,
      animDist: typeof s.animDist === 'number' ? s.animDist : 0,
      flyY: typeof s.flyY === 'number' ? s.flyY : FLY_Y_BASE,
    })),
  }
}

export function loadSave(userId: string): TowerSave {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return initialSave()
    const parsed = parseSave(JSON.parse(raw), 1)
    return parsed ?? initialSave()
  } catch {
    return initialSave()
  }
}

export function writeSave(userId: string, save: TowerSave) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(save))
  } catch {
    // ignore quota / private mode
  }
}
