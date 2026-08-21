export type StatId = 'hp' | 'atk' | 'def'
export type SpeedRate = 1 | 2 | 3

import type { SoldierCategory, SoldierId } from './excelData'

/**
 * "HeroKindId" is kept as a legacy name, but it now maps to Excel-driven soldier IDs.
 * (We keep the property name `kind` to avoid a large refactor of the rendering pipeline.)
 */
export type HeroKindId = SoldierId
export type HeroCategory = SoldierCategory
export type EnemyShape =
  | 'worm'
  | 'imp'
  | 'blob'
  | 'ghost'
  | 'fox'
  | 'scroll'
  | 'golem'
  | 'boss'

export type TowerPhase =
  | 'approach'
  | 'combat'
  | 'victory'
  | 'climb'
  | 'defeat'

export type HeroStrike = 'idle' | 'lunge' | 'impact' | 'recover'

export type SoldierStateKind =
  | 'spawning'
  | 'marching'
  | 'climbing'
  | 'lunging'
  | 'impact'
  | 'recoil'
  | 'idle'
  | 'dead'

export interface TowerSave {
  version: 4
  bestFloor: number
  hp: number
  maxHp: number
  atk: number
  def: number
  gold: number
  exp: number
  level: number
  unspent: number
  speed: SpeedRate
  heroLevels: Record<HeroKindId, number>
  nextSoldierId: number
  floors: FloorState[]
  soldiers: SoldierState[]
}

export interface Enemy {
  name: string
  title: string
  isBoss: boolean
  shape: EnemyShape
  /** Excel soldier-category matchup (哲/文/詩/詞). */
  category: HeroCategory
  hp: number
  maxHp: number
  atk: number
}

export interface FloorState {
  floor: number
  enemy: Enemy | null
  respawnIn: number
  cleared: boolean
}

export interface SoldierState {
  id: number
  kind: HeroKindId
  hp: number
  maxHp: number
  atk: number
  floor: number
  x: number
  y: number
  facing: 1 | -1
  state: SoldierStateKind
  t: number
  homeX: number
  targetFloor: number
  targetX: number
  /** Walk cycle frame index (0 … HERO_WALK_FRAME_COUNT − 1). */
  frame: number
  /** Accumulated normalized x travel since last frame advance. */
  animDist: number
  /** Hover height within the current floor band (0 = platform). */
  flyY: number
}

export interface Floater {
  life: number
  maxLife: number
  x: number
  y: number
  vy: number
  text: string
  color: string
}

export interface Particle {
  life: number
  maxLife: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
}

export interface SoldierRender {
  id: number
  x: number
  y: number
  /** floor + climb offset for smooth vertical interpolation. */
  worldY: number
}

export interface RenderFrame {
  cameraFloor: number
  time: number
  soldiers: SoldierRender[]
}

export interface TowerRuntime {
  time: number
  spawnT: number
  spawnTByKind: Record<HeroKindId, number>
  /** Integer focus floor for HUD / combat context. */
  viewedFloor: number
  /** Smoothed camera anchor (top of the 6-floor viewport). */
  cameraFloor: number
  reducedMotion: boolean
  floaters: Floater[]
  particles: Particle[]
  /** Previous / current logic frames for render interpolation. */
  renderPrev: RenderFrame
  renderCurr: RenderFrame
}

export interface TowerSnapshot {
  floor: number
  bestFloor: number
  topFloor: number
  hp: number
  maxHp: number
  atk: number
  def: number
  gold: number
  exp: number
  expToNext: number
  level: number
  unspent: number
  speed: SpeedRate
  paused: boolean
  phase: TowerPhase | 'advance'
  enemyName: string
  enemyTitle: string
  enemyIsBoss: boolean
  enemyHp: number
  enemyMaxHp: number
  heroLevels: Record<HeroKindId, number>
  unlockedSoldiers: HeroKindId[]
  spawnProgressByKind: Record<HeroKindId, number>
  nextSpawnKind: HeroKindId | null
  nextSpawnProgress: number
  liveSoldiers: number
  reviveCost: number
  canRevive: boolean
  defeated: boolean
}
