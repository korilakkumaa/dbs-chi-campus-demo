import {
  ENEMY_HEIGHT_RATIO,
  HERO_HEIGHT_RATIO,
  LANE_FROM_EDGE,
  PARTY_SPACING,
  STAIR_FROM_EDGE,
  STAIR_SPAN,
  TOWER_SIDE_PAD,
  TOWER_WIDTH,
} from './config'

/** Odd floors fight rightward; even floors fight leftward. */
export function lane(floor: number): 1 | -1 {
  return floor % 2 === 1 ? 1 : -1
}

export function heroHome(floor: number) {
  return lane(floor) > 0 ? LANE_FROM_EDGE : 1 - LANE_FROM_EDGE
}

/** Standing slot for party member `index` (0 = closest to the enemy). */
export function partySlotX(floor: number, index: number) {
  return heroHome(floor) - lane(floor) * PARTY_SPACING * index
}

export function enemyHome(floor: number) {
  return lane(floor) > 0 ? 1 - LANE_FROM_EDGE : LANE_FROM_EDGE
}

export function contactX(floor: number) {
  const from = heroHome(floor)
  const to = enemyHome(floor)
  return from + (to - from) * 0.7
}

/** Inner edge of the bottom step — walk here first. */
export function stairApproachX(floor: number) {
  return lane(floor) > 0 ? 1 - STAIR_SPAN : STAIR_SPAN
}

/** Inner edge of the top step — nearer the wall. */
export function stairTopX(floor: number) {
  return lane(floor) > 0 ? 1 - STAIR_FROM_EDGE : STAIR_FROM_EDGE
}

export function stageMetrics(w: number, h: number) {
  const band = Math.max(80, Math.round((h * 0.18) / 2) * 2)
  const fightY = Math.round(h * 0.74)
  const towerW = Math.min(TOWER_WIDTH, Math.max(160, w - TOWER_SIDE_PAD * 2))
  const towerLeft = Math.round((w - towerW) / 2)
  const heroH = Math.round(band * HERO_HEIGHT_RATIO)
  const enemyH = Math.round(band * ENEMY_HEIGHT_RATIO)
  return { band, fightY, towerW, towerLeft, heroH, enemyH }
}
