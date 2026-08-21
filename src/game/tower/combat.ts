import { makeEnemy } from './floors'
import { heroUpgradeBatchCost } from './heroes'
import { TOWER_EXCEL } from './excelData'
import type { HeroKindId, StatId, TowerSave } from './types'

export const STAT_LABEL: Record<StatId, string> = {
  hp: '氣血',
  atk: '攻擊',
  def: '防禦',
}

export function heroDamage(atk: number, atkMul = 1) {
  return Math.max(1, Math.round(atk * atkMul))
}

export function enemyDamage(enemyAtk: number, def: number) {
  return Math.max(0, enemyAtk - def)
}

export function checkpointFloor(floor: number) {
  return Math.floor((Math.max(1, floor) - 1) / 10) * 10 + 1
}

export function expToNext(level: number) {
  return 14 + level * 8
}

export function lootFor(floor: number, isBoss: boolean) {
  const exp = (4 + floor * 2) * (isBoss ? 3 : 1)
  const gold = (3 + floor) * (isBoss ? 2 : 1)
  return { exp, gold }
}

export function applyLevelUps(save: TowerSave) {
  let leveled = false
  while (save.exp >= expToNext(save.level)) {
    save.exp -= expToNext(save.level)
    save.level += 1
    save.unspent += 3
    leveled = true
  }
  return leveled
}

export function healAfterVictory(save: TowerSave) {
  const heal = Math.max(1, Math.round(save.maxHp * 0.08))
  save.hp = Math.min(save.maxHp, save.hp + heal)
}

export function reviveCost(floor: number) {
  return 20 + floor * 4
}

export function upgradeHeroes(save: TowerSave, kind: HeroKindId, levels = 1) {
  const level = save.heroLevels[kind] ?? 0
  const gain = Math.max(1, Math.floor(levels))
  const cost = heroUpgradeBatchCost(kind, level, gain)
  if (save.gold < cost) return false
  save.gold -= cost
  save.heroLevels[kind] = level + gain
  return true
}

export function allocateStat(save: TowerSave, stat: StatId) {
  if (save.unspent <= 0) return false
  save.unspent -= 1
  if (stat === 'hp') {
    save.maxHp += 14
    save.hp += 14
  } else if (stat === 'atk') {
    save.atk += 2
  } else {
    save.def += 1
  }
  return true
}

export function initialSave(bestFloor = 1): TowerSave {
  const enemy = makeEnemy(1)

  const heroLevels = Object.fromEntries(
    TOWER_EXCEL.soldiers.map((s) => [s.id, 0]),
  ) as Record<HeroKindId, number>

  return {
    version: 4,
    bestFloor: Math.max(1, bestFloor),
    hp: 120,
    maxHp: 120,
    atk: 14,
    def: 5,
    gold: 90,
    exp: 0,
    level: 1,
    unspent: 0,
    speed: 1,
    heroLevels,
    nextSoldierId: 2,
    floors: [
      {
        floor: 1,
        enemy,
        respawnIn: 0,
        cleared: false,
      },
    ],
    soldiers: [],
  }
}
