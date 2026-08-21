import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  allocateStat,
  checkpointFloor,
  enemyDamage,
  healAfterVictory,
  heroDamage,
  initialSave,
  lootFor,
  reviveCost,
  upgradeHeroes,
} from './combat'
import {
  CLIMB_CAM_SEC,
  CLIMB_LIFT_SEC,
  ENEMY_REGEN_PERCENT,
  ENEMY_REGEN_SPEED,
  FLY_HOVER_AMP,
  FLY_HOVER_HZ,
  FLY_HOVER_TAU,
  FLY_Y_BASE,
  FLY_Y_MAX,
  FLY_Y_MIN,
  HERO_CLIMB_SPEED,
  HERO_COUNT,
  HERO_WALK_SPEED,
  HERO_WALK_X_PER_SEC,
  MOVE_ACCEL_MUL,
  MOVE_DECEL_MUL,
  RECOIL_DISTANCE,
  STAIR_PAUSE_SEC,
} from './config'
import {
  HERO_KIND_CATALOG,
  heroAtkFor,
  heroHpFor,
  heroKind,
  heroMoveSpeed,
  heroMatchupMultiplier,
  heroSpawnSeconds,
} from './heroes'
import { TOWER_EXCEL } from './excelData'
import { formatExcelNumber } from './excelNumber'
import { makeEnemy } from './floors'
import {
  HERO_WALK_FRAME_COUNT,
  HERO_WALK_FRAME_WIDTH,
} from './heroSprite'
import {
  contactX,
  enemyHome,
  heroHome,
  lane,
  partySlotX,
} from './layout'
import { loadSave, writeSave } from './save'
import type {
  FloorState,
  Floater,
  HeroKindId,
  Particle,
  SoldierState,
  SpeedRate,
  StatId,
  TowerRuntime,
  TowerSave,
  TowerSnapshot,
  RenderFrame,
  SoldierRender,
} from './types'

const FLOAT_N = 32
const PART_N = 64
const MONSTER_RESPAWN_SEC = 5
const IMPACT_SEC = 0.14
const ENEMY_STRIKE_SEC = 0.55
const RECOIL_SEC = 0.38
const LUNGE_SPEED_MUL = 1.85
const HUD_EMIT_INTERVAL = 0.07

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function emptyFloater(): Floater {
  return { life: 0, maxLife: 1, x: 0, y: 0, vy: 0, text: '', color: '' }
}

function emptyParticle(): Particle {
  return {
    life: 0,
    maxLife: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    color: '',
  }
}

function spawnFloater(runtime: TowerRuntime, x: number, y: number, text: string, color: string) {
  for (const f of runtime.floaters) {
    if (f.life > 0) continue
    f.life = 0.9
    f.maxLife = 0.9
    f.x = x
    f.y = y
    f.vy = -46
    f.text = text
    f.color = color
    return
  }
}

function spawnBurst(runtime: TowerRuntime, x: number, y: number, color: string, count: number) {
  if (runtime.reducedMotion) return
  let left = count
  for (const p of runtime.particles) {
    if (left <= 0) return
    if (p.life > 0) continue
    const ang = Math.random() * Math.PI * 2
    const spd = 28 + Math.random() * 90
    p.life = 0.35 + Math.random() * 0.35
    p.maxLife = p.life
    p.x = x
    p.y = y
    p.vx = Math.cos(ang) * spd
    p.vy = Math.sin(ang) * spd - 30
    p.size = 1.6 + Math.random() * 2.4
    p.color = color
    left -= 1
  }
}

function emptyRenderFrame(): RenderFrame {
  return { cameraFloor: 1, time: 0, soldiers: [] }
}

function emptyRuntime(): TowerRuntime {
  const spawnTByKind = Object.fromEntries(
    TOWER_EXCEL.soldiers.map((s) => [s.id, 0]),
  ) as TowerRuntime['spawnTByKind']
  const render = emptyRenderFrame()
  return {
    time: 0,
    spawnT: 0,
    spawnTByKind,
    viewedFloor: 1,
    cameraFloor: 1,
    reducedMotion: false,
    floaters: Array.from({ length: FLOAT_N }, emptyFloater),
    particles: Array.from({ length: PART_N }, emptyParticle),
    renderPrev: render,
    renderCurr: render,
  }
}

function cloneEnemy(floor: number) {
  return makeEnemy(floor)
}

function topFloor(save: TowerSave) {
  return save.floors.reduce((m, f) => Math.max(m, f.floor), 1)
}

function liveSoldiers(save: TowerSave) {
  return save.soldiers.filter((s) => s.state !== 'dead')
}

function createFloor(floor: number): FloorState {
  return { floor, enemy: cloneEnemy(floor), respawnIn: 0, cleared: false }
}

export class TowerEngine {
  userId: string
  save: TowerSave
  runtime: TowerRuntime
  paused = false
  private listeners = new Set<() => void>()
  private snapshot: TowerSnapshot
  private persistTimer = 0
  private lastHudEmit = 0
  private moveVx = new Map<number, number>()
  private climbStart = new Map<number, { worldY: number; x: number }>()

  constructor(userId: string) {
    this.userId = userId
    this.save = loadSave(userId)
    this.runtime = emptyRuntime()
    this.updateViewedFloor()
    this.runtime.cameraFloor = this.runtime.viewedFloor
    this.syncRenderFrames()
    this.snapshot = this.buildSnapshot()
  }

  /** Call before each fixed logic tick (copies current frame → previous). */
  beginFixedStep() {
    this.runtime.renderPrev = this.runtime.renderCurr
  }

  /** Refresh render snapshot after a fixed logic tick. */
  syncRenderFrames() {
    this.runtime.renderCurr = this.captureRenderFrame()
  }

  /** Absolute vertical position used for drawing (floor index + in-layer offset). */
  soldierRenderWorldY(s: SoldierState) {
    if (s.state === 'climbing' && s.t >= 0) {
      const start = this.climbStart.get(s.id)
      if (start) {
        const climbSec = this.climbDuration(s)
        const u = Math.min(1, s.t / Math.max(0.001, climbSec))
        const eased = u * u * (3 - 2 * u)
        const endWorldY = s.floor + 1 + FLY_Y_BASE
        return start.worldY + (endWorldY - start.worldY) * eased
      }
    }
    return s.floor + s.flyY
  }

  private captureRenderFrame(): RenderFrame {
    const soldiers: SoldierRender[] = []
    for (const s of this.save.soldiers) {
      if (s.state === 'dead') continue
      soldiers.push({
        id: s.id,
        x: s.x,
        y: s.flyY,
        worldY: this.soldierRenderWorldY(s),
      })
    }
    return {
      cameraFloor: this.runtime.cameraFloor,
      time: this.runtime.time,
      soldiers,
    }
  }

  /** Interpolated draw positions for one soldier (0 = prev tick, 1 = curr tick). */
  renderSoldier(id: number, alpha: number) {
    const prev = this.runtime.renderPrev.soldiers.find((s) => s.id === id)
    const curr = this.runtime.renderCurr.soldiers.find((s) => s.id === id)
    if (!prev && !curr) return null
    if (!prev) return curr
    if (!curr) return prev
    const t = Math.max(0, Math.min(1, alpha))
    const worldY = prev.worldY + (curr.worldY - prev.worldY) * t
    return {
      x: prev.x + (curr.x - prev.x) * t,
      worldY,
      floor: Math.floor(worldY),
      y: worldY - Math.floor(worldY),
    }
  }

  /** Interpolated camera anchor for the viewport. */
  renderCamera(alpha: number) {
    const t = Math.max(0, Math.min(1, alpha))
    return (
      this.runtime.renderPrev.cameraFloor +
      (this.runtime.renderCurr.cameraFloor - this.runtime.renderPrev.cameraFloor) * t
    )
  }

  /** Time used for walk-cycle animation (interpolated between logic ticks). */
  renderTime(alpha: number) {
    const t = Math.max(0, Math.min(1, alpha))
    return this.runtime.renderPrev.time + (this.runtime.renderCurr.time - this.runtime.renderPrev.time) * t
  }

  private clearMoveVx(soldierId: number) {
    this.moveVx.delete(soldierId)
  }

  private advanceWalkAnim(soldier: SoldierState, oldX: number, newX: number) {
    const walking =
      soldier.state === 'marching' ||
      soldier.state === 'spawning' ||
      soldier.state === 'climbing' ||
      soldier.state === 'lunging'
    if (!walking) return

    const moved = Math.abs(newX - oldX)
    if (moved <= 0) return

    soldier.animDist += moved
    while (soldier.animDist >= HERO_WALK_FRAME_WIDTH) {
      soldier.frame = (soldier.frame + 1) % HERO_WALK_FRAME_COUNT
      soldier.animDist -= HERO_WALK_FRAME_WIDTH
    }
  }

  private setSoldierX(soldier: SoldierState, newX: number) {
    const oldX = soldier.x
    soldier.x = newX
    this.advanceWalkAnim(soldier, oldX, newX)
  }

  private tickFlyHover(soldier: SoldierState, dt: number) {
    if (soldier.state === 'dead') return
    if (soldier.state === 'climbing' && soldier.t >= 0) return

    const target =
      FLY_Y_BASE +
      FLY_HOVER_AMP * Math.sin(this.runtime.time * FLY_HOVER_HZ * Math.PI * 2 + soldier.id * 1.37)
    const blend = this.runtime.reducedMotion ? 1 : 1 - Math.exp(-dt / FLY_HOVER_TAU)
    soldier.flyY += (target - soldier.flyY) * blend
    soldier.flyY = Math.max(FLY_Y_MIN, Math.min(FLY_Y_MAX, soldier.flyY))
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  setReducedMotion(value: boolean) {
    this.runtime.reducedMotion = value
  }

  allocate = (stat: StatId) => {
    if (!allocateStat(this.save, stat)) return
    this.emit(true)
  }

  upgradeHeroes = () => {
    this.upgradeHeroKind(heroKind().id)
  }

  upgradeHeroKind = (kind: HeroKindId, levels = 1) => {
    if (this.isDefeated()) return
    const wasActive = (this.save.heroLevels[kind] ?? 0) > 0
    if (!upgradeHeroes(this.save, kind, levels)) return
    const level = this.save.heroLevels[kind] ?? 0
    for (const soldier of this.save.soldiers) {
      if (soldier.state === 'dead' || soldier.kind !== kind) continue
      soldier.maxHp = heroHpFor(kind, level)
      soldier.hp = Math.min(soldier.maxHp, soldier.hp + 8)
      soldier.atk = heroAtkFor(kind, level)
    }
    spawnFloater(this.runtime, 0.5, 0.4, wasActive ? '士兵升級' : '士兵激活', '#e8c878')
    this.emit(true)
  }

  setSpeed = (speed: SpeedRate) => {
    if (this.save.speed === speed) return
    this.save.speed = speed
    this.emit(true)
  }

  togglePause = () => {
    if (this.isDefeated()) return
    this.paused = !this.paused
    this.emit(false)
  }

  private resetRuntime() {
    this.runtime = emptyRuntime()
    this.moveVx.clear()
    this.climbStart.clear()
    this.updateViewedFloor()
    this.runtime.cameraFloor = this.runtime.viewedFloor
    this.syncRenderFrames()
  }

  revive = () => {
    if (!this.isDefeated()) return
    const cost = reviveCost(this.snapshot.floor)
    if (this.save.gold < cost) return
    const remainingGold = this.save.gold - cost
    const speed = this.save.speed
    this.save.hp = this.save.maxHp
    this.save = initialSave(this.save.bestFloor)
    this.save.gold = remainingGold
    this.save.speed = speed
    this.resetRuntime()
    this.paused = false
    this.emit(true)
  }

  retreat = () => {
    if (!this.isDefeated()) return
    const best = checkpointFloor(this.snapshot.floor)
    this.save = initialSave(Math.max(this.save.bestFloor, best))
    this.resetRuntime()
    this.paused = false
    this.emit(true)
  }

  abandon = () => {
    const best = this.save.bestFloor
    const speed = this.save.speed
    this.save = initialSave(best)
    this.save.speed = speed
    this.resetRuntime()
    this.paused = false
    this.emit(true)
  }

  dispose() {
    if (this.persistTimer) window.clearTimeout(this.persistTimer)
    writeSave(this.userId, this.save)
  }

  step(dt: number) {
    const cap = Math.min(0.05, Math.max(0, dt))
    if (this.paused && !this.isDefeated()) return

    this.runtime.time += cap
    this.decayVisuals(cap)
    if (this.isDefeated()) {
      this.syncRenderFrames()
      return
    }

    const t = cap * this.save.speed
    this.tickEnemyRegen(t)
    this.tickEnemyRespawn(t)
    this.tickHeroSpawn(t)
    this.tickSoldiers(t)
    this.ensureNextFloor()
    this.updateViewedFloor()
    this.tickCamera(cap)
    this.syncRenderFrames()
    this.emit(false)
  }

  private walkRate(soldier: SoldierState) {
    const level = this.save.heroLevels[soldier.kind] ?? 0
    const base =
      heroMoveSpeed(soldier.kind, level) * HERO_WALK_X_PER_SEC * HERO_WALK_SPEED
    return this.runtime.reducedMotion ? base * 3 : base
  }

  private getFloor(floor: number) {
    let state = this.save.floors.find((f) => f.floor === floor)
    if (!state) {
      state = createFloor(floor)
      this.save.floors.push(state)
      this.save.floors.sort((a, b) => a.floor - b.floor)
    }
    return state
  }

  private isDefeated() {
    return this.save.hp <= 0
  }

  private liveSoldiers() {
    return liveSoldiers(this.save)
  }

  private unlockedKinds() {
    const all = TOWER_EXCEL.soldiers.map((s) => s.id)
    // Temporary unlock rule derived from progression:
    // - Start with 3 unlocked soldiers at bestFloor=1.
    // - Unlock 1 additional soldier every 5 floors.
    const unlockStart = Math.min(3, all.length)
    const unlockPer = 5
    const extra = Math.max(0, Math.floor((this.save.bestFloor - 1) / unlockPer))
    const unlockedCount = Math.min(all.length, unlockStart + extra)
    return all.slice(0, unlockedCount) as HeroKindId[]
  }

  private activeKinds() {
    return this.unlockedKinds()
  }

  private nextSpawnInfo() {
    if (this.liveSoldiers().length >= Math.max(1, Math.min(4, HERO_COUNT))) {
      return { kind: null, progress: 0 }
    }
    const activeKinds = this.activeKinds()
    if (activeKinds.length === 0) return { kind: null, progress: 0 }
    const kind = activeKinds[(this.save.nextSoldierId - 1) % activeKinds.length]
    const level = this.save.heroLevels[kind] ?? 0
    const spawnSec = heroSpawnSeconds(kind, level)
    if (!Number.isFinite(spawnSec) || spawnSec <= 0) return { kind, progress: 0 }
    return {
      kind,
      progress: Math.max(
        0,
        Math.min(1, (this.runtime.spawnTByKind[kind] ?? 0) / spawnSec),
      ),
    }
  }

  private spawnProgressByKind() {
    const progress = Object.fromEntries(
      TOWER_EXCEL.soldiers.map((s) => [s.id, 0]),
    ) as Record<HeroKindId, number>

    for (const kind of this.activeKinds()) {
      const level = this.save.heroLevels[kind] ?? 0
      const spawnSec = heroSpawnSeconds(kind, level)
      if (!Number.isFinite(spawnSec) || spawnSec <= 0) continue
      const timer = this.runtime.spawnTByKind[kind] ?? 0
      progress[kind] = Math.max(0, Math.min(1, timer / spawnSec))
    }
    return progress
  }

  private lowestEnemyFloor() {
    const live = this.save.floors.filter((f) => f.enemy && f.enemy.hp > 0)
    return live.length === 0 ? topFloor(this.save) : Math.min(...live.map((f) => f.floor))
  }

  private ensureNextFloor() {
    const top = topFloor(this.save)
    const topState = this.getFloor(top)
    if (topState.enemy === null && topState.cleared) this.getFloor(top + 1)
  }

  private tickEnemyRespawn(dt: number) {
    for (const floor of this.save.floors) {
      if (!floor.cleared || floor.enemy) continue
      floor.respawnIn = Math.max(0, floor.respawnIn - dt)
      if (floor.respawnIn > 0) continue
      floor.enemy = cloneEnemy(floor.floor)
      floor.cleared = false
      spawnFloater(this.runtime, enemyHome(floor.floor), 0.52, '再現', '#c45a3a')
    }
  }

  private tickEnemyRegen(dt: number) {
    if (ENEMY_REGEN_SPEED <= 0 || ENEMY_REGEN_PERCENT <= 0) return
    for (const floor of this.save.floors) {
      if (!floor.enemy || floor.enemy.hp <= 0 || floor.enemy.hp >= floor.enemy.maxHp) continue
      floor.respawnIn += dt * ENEMY_REGEN_SPEED
      while (floor.respawnIn >= 1) {
        floor.respawnIn -= 1
        const heal = Math.max(1, Math.round(floor.enemy.maxHp * ENEMY_REGEN_PERCENT))
        const next = Math.min(floor.enemy.maxHp, floor.enemy.hp + heal)
        const gained = next - floor.enemy.hp
        floor.enemy.hp = next
        if (gained > 0)
          spawnFloater(
            this.runtime,
            enemyHome(floor.floor),
            0.5,
            `+${formatExcelNumber(gained)}`,
            '#7cbc8c',
          )
      }
    }
  }

  private spawnSoldier(kind: HeroKindId) {
    const level = this.save.heroLevels[kind] ?? 0
    const soldier: SoldierState = {
      id: this.save.nextSoldierId,
      kind,
      hp: heroHpFor(kind, level),
      maxHp: heroHpFor(kind, level),
      atk: heroAtkFor(kind, level),
      floor: 1,
      x: 0.08,
      y: 0,
      facing: lane(1),
      state: 'spawning',
      t: 0,
      homeX: partySlotX(1, this.liveSoldiers().length),
      targetFloor: this.lowestEnemyFloor(),
      targetX: partySlotX(1, this.liveSoldiers().length),
      frame: 0,
      animDist: 0,
      flyY: FLY_Y_BASE,
    }
    this.save.nextSoldierId += 1
    this.save.soldiers.push(soldier)
    spawnFloater(this.runtime, soldier.x, 0.82, '加入', '#e8c878')
  }

  private tickHeroSpawn(dt: number) {
    const activeKinds = this.activeKinds()
    if (activeKinds.length === 0) return
    const cap = Math.max(1, Math.min(4, HERO_COUNT))

    for (const kind of activeKinds) {
      const level = this.save.heroLevels[kind] ?? 0
      const spawnSec = heroSpawnSeconds(kind, level)
      if (!Number.isFinite(spawnSec)) continue
      this.runtime.spawnTByKind[kind] = (this.runtime.spawnTByKind[kind] ?? 0) + dt
      this.runtime.spawnT = this.runtime.spawnTByKind[kind]
      while (this.runtime.spawnTByKind[kind] >= spawnSec) {
        if (this.liveSoldiers().length >= cap) {
          this.runtime.spawnTByKind[kind] = spawnSec
          break
        }
        this.runtime.spawnTByKind[kind] -= spawnSec
        this.spawnSoldier(kind)
      }
    }
  }

  private moveX(
    cur: number,
    target: number,
    dt: number,
    rate: number,
    soldierId: number,
    accelMul = MOVE_ACCEL_MUL,
  ) {
    const maxRate = rate
    const accel = maxRate * accelMul
    const decel = maxRate * MOVE_DECEL_MUL
    let vx = this.moveVx.get(soldierId) ?? 0
    const dx = target - cur
    const dist = Math.abs(dx)

    if (dist <= 0.00005) {
      this.moveVx.set(soldierId, 0)
      return { value: target, done: true }
    }

    const dir = Math.sign(dx)
    const brakeDist = ((vx * vx) / (2 * decel)) * 1.15
    let nextVx: number
    if (dist <= brakeDist) {
      nextVx = Math.max(0, vx - decel * dt)
    } else {
      const accelT = Math.min(1, vx / maxRate)
      const smoothAccel = accel * (0.35 + 0.65 * (1 - accelT))
      nextVx = Math.min(maxRate, vx + smoothAccel * dt)
    }

    const step = nextVx * dt
    if (step >= dist) {
      this.moveVx.set(soldierId, 0)
      return { value: target, done: true }
    }

    this.moveVx.set(soldierId, nextVx)
    return { value: cur + dir * step, done: false }
  }

  private climbDuration(soldier: SoldierState) {
    const level = this.save.heroLevels[soldier.kind] ?? 0
    const climbMul = HERO_KIND_CATALOG[soldier.kind].scale
    const speedMul = Math.max(
      0.35,
      HERO_CLIMB_SPEED * climbMul * heroMoveSpeed(soldier.kind, level),
    )
    return CLIMB_LIFT_SEC / speedMul
  }

  private enemyAttack(soldier: SoldierState, floor: FloorState) {
    if (!floor.enemy) return
    const dmg = enemyDamage(floor.enemy.atk, this.save.def)
    soldier.hp = Math.max(0, soldier.hp - dmg)
    this.save.hp = Math.max(0, this.save.hp - Math.max(0, Math.round(dmg * 0.35)))
    spawnFloater(this.runtime, soldier.x, 0.58, `-${formatExcelNumber(dmg)}`, '#c45a3a')
    spawnBurst(this.runtime, soldier.x, 0.66, '#c45a3a', 8)
    if (soldier.hp <= 0) {
      soldier.state = 'dead'
      spawnFloater(this.runtime, soldier.x, 0.62, '退場', '#c45a3a')
    } else {
      soldier.state = 'recoil'
      soldier.t = 0
      soldier.targetX = soldier.x - lane(soldier.floor) * RECOIL_DISTANCE
    }
  }

  private clearFloor(soldier: SoldierState, floor: FloorState) {
    if (!floor.enemy) return
    const loot = lootFor(floor.floor, floor.enemy.isBoss)
    this.save.gold += loot.gold
    healAfterVictory(this.save)
    this.save.bestFloor = Math.max(this.save.bestFloor, floor.floor)
    floor.enemy = null
    floor.cleared = true
    floor.respawnIn = MONSTER_RESPAWN_SEC
    soldier.state = 'climbing'
    soldier.t = -STAIR_PAUSE_SEC
    this.climbStart.delete(soldier.id)
    soldier.targetFloor = floor.floor + 1
    spawnFloater(
      this.runtime,
      0.5,
      0.42,
      `+${formatExcelNumber(loot.gold)} 金`,
      '#e8c878',
    )
    spawnBurst(this.runtime, soldier.x, 0.62, '#c4a035', 18)
  }

  private heroAttack(soldier: SoldierState, floor: FloorState) {
    if (!floor.enemy) return
    const mult = heroMatchupMultiplier(soldier.kind, floor.enemy.category)
    const dmg = heroDamage(soldier.atk, mult)
    floor.enemy.hp = Math.max(0, floor.enemy.hp - dmg)
    spawnFloater(this.runtime, enemyHome(floor.floor), 0.58, `-${formatExcelNumber(dmg)}`, '#e8c878')
    spawnBurst(this.runtime, enemyHome(floor.floor), 0.66, '#b8682a', floor.enemy.isBoss ? 16 : 10)
    if (floor.enemy.hp <= 0) this.clearFloor(soldier, floor)
    else {
      soldier.state = 'impact'
      soldier.t = 0
    }
  }

  private tickSoldier(soldier: SoldierState, dt: number) {
    if (soldier.state === 'dead') return
    if (!(soldier.state === 'climbing' && soldier.t >= 0)) {
      this.tickFlyHover(soldier, dt)
    }
    const dir = lane(soldier.floor)
    const floor = this.getFloor(soldier.floor)
    const liveEnemy = floor.enemy && floor.enemy.hp > 0 ? floor.enemy : null

    if (soldier.state === 'spawning') {
      soldier.facing = lane(1)
      const next = this.moveX(soldier.x, heroHome(1), dt, this.walkRate(soldier), soldier.id)
      this.setSoldierX(soldier, next.value)
      if (next.done) {
        this.clearMoveVx(soldier.id)
        soldier.state = 'idle'
      }
      return
    }

    if (soldier.state === 'climbing') {
      if (soldier.t < 0) {
        soldier.t = Math.min(0, soldier.t + dt)
        soldier.facing = dir
        return
      }

      if (!this.climbStart.has(soldier.id)) {
        this.climbStart.set(soldier.id, {
          worldY: soldier.floor + soldier.flyY,
          x: soldier.x,
        })
        soldier.t = 0
      }

      const climbSec = this.climbDuration(soldier)
      soldier.t = Math.min(climbSec, soldier.t + dt)
      const u = Math.min(1, soldier.t / Math.max(0.001, climbSec))
      const eased = u * u * (3 - 2 * u)
      const start = this.climbStart.get(soldier.id)!
      const endX = heroHome(soldier.floor + 1)
      soldier.x = start.x + (endX - start.x) * eased
      soldier.facing = dir

      if (u >= 1) {
        soldier.floor += 1
        soldier.x = endX
        soldier.flyY = FLY_Y_BASE
        soldier.y = 0
        this.climbStart.delete(soldier.id)
        this.clearMoveVx(soldier.id)
        soldier.state = 'idle'
        soldier.targetFloor = Math.max(soldier.floor, this.lowestEnemyFloor())
      }
      return
    }

    if (soldier.state === 'recoil') {
      this.clearMoveVx(soldier.id)
      soldier.t += dt / RECOIL_SEC
      const t = Math.min(1, soldier.t)
      const eased = easeOutCubic(t)
      const from = contactX(soldier.floor)
      const to = soldier.targetX
      soldier.x = from + (to - from) * eased
      soldier.y = 4 * t * (1 - t) * 0.28
      soldier.facing = dir
      if (t >= 1) {
        soldier.y = 0
        soldier.state = 'idle'
        soldier.t = 0
      }
      return
    }

    if (soldier.state === 'impact') {
      this.clearMoveVx(soldier.id)
      soldier.t += dt / IMPACT_SEC
      soldier.facing = dir
      if (soldier.t >= 1) {
        soldier.t = 0
        this.enemyAttack(soldier, floor)
      }
      return
    }

    if (!liveEnemy) {
      if (soldier.floor < this.lowestEnemyFloor()) {
        this.clearMoveVx(soldier.id)
        this.climbStart.delete(soldier.id)
        soldier.state = 'climbing'
        soldier.t = -STAIR_PAUSE_SEC
      } else {
        this.clearMoveVx(soldier.id)
        soldier.state = 'idle'
      }
      return
    }

    if (soldier.state === 'idle' || soldier.state === 'marching') {
      if (soldier.floor < this.lowestEnemyFloor()) {
        this.clearMoveVx(soldier.id)
        this.climbStart.delete(soldier.id)
        soldier.state = 'climbing'
        soldier.t = -STAIR_PAUSE_SEC
        return
      }
      soldier.state = 'marching'
      soldier.facing = dir
      const next = this.moveX(
        soldier.x,
        contactX(soldier.floor),
        dt,
        this.walkRate(soldier),
        soldier.id,
      )
      this.setSoldierX(soldier, next.value)
      if (next.done) {
        this.clearMoveVx(soldier.id)
        soldier.state = 'lunging'
        soldier.t = 0
      }
      return
    }

    if (soldier.state === 'lunging') {
      const next = this.moveX(
        soldier.x,
        contactX(soldier.floor),
        dt,
        this.walkRate(soldier) * LUNGE_SPEED_MUL,
        soldier.id,
        8,
      )
      this.setSoldierX(soldier, next.value)
      soldier.facing = dir
      soldier.t += dt
      if (next.done) {
        this.clearMoveVx(soldier.id)
        this.setSoldierX(soldier, contactX(soldier.floor))
        soldier.t = 0
        this.heroAttack(soldier, floor)
      }
      return
    }

    if (soldier.state === 'marching' && liveEnemy) {
      soldier.t += dt
      if (soldier.t >= ENEMY_STRIKE_SEC) {
        soldier.t = 0
        this.enemyAttack(soldier, floor)
      }
    }
  }

  private tickSoldiers(dt: number) {
    for (const soldier of this.save.soldiers) this.tickSoldier(soldier, dt)
    const dead = this.save.soldiers.filter((s) => s.state === 'dead')
    for (const s of dead) {
      this.clearMoveVx(s.id)
      this.climbStart.delete(s.id)
    }
    this.save.soldiers = this.save.soldiers.filter((s) => s.state !== 'dead')
  }

  private updateViewedFloor() {
    const soldierTop = this.liveSoldiers().reduce((m, s) => Math.max(m, s.floor), 1)
    const enemyTop = this.save.floors.reduce(
      (m, f) => (f.enemy ? Math.max(m, f.floor) : m),
      1,
    )
    this.runtime.viewedFloor = Math.max(1, Math.max(soldierTop, enemyTop))
  }

  private cameraTarget() {
    let target = this.runtime.viewedFloor
    for (const soldier of this.liveSoldiers()) {
      if (soldier.state !== 'climbing' || soldier.t < 0) continue
      target = Math.max(target, this.soldierRenderWorldY(soldier) * 0.95)
    }
    return target
  }

  private tickCamera(dt: number) {
    const target = this.cameraTarget()
    if (this.runtime.reducedMotion) {
      this.runtime.cameraFloor = target
      return
    }
    const tau = CLIMB_CAM_SEC * 0.5
    const blend = 1 - Math.exp(-dt / Math.max(0.001, tau))
    this.runtime.cameraFloor += (target - this.runtime.cameraFloor) * blend
    if (Math.abs(target - this.runtime.cameraFloor) < 0.003) {
      this.runtime.cameraFloor = target
    }
  }

  private currentEnemyFloor() {
    const floor = this.save.floors.find((f) => f.floor === this.runtime.viewedFloor && f.enemy)
    if (floor) return floor
    const live = this.save.floors.filter((f) => f.enemy)
    return live[live.length - 1] ?? this.save.floors[this.save.floors.length - 1]
  }

  private decayVisuals(dt: number) {
    for (const f of this.runtime.floaters) {
      if (f.life <= 0) continue
      f.life -= dt
      f.y += (f.vy * dt) / 500
      f.vy *= Math.exp(-dt * 1.4)
    }
    for (const p of this.runtime.particles) {
      if (p.life <= 0) continue
      p.life -= dt
      p.x += (p.vx * dt) / 500
      p.y += (p.vy * dt) / 500
      p.vy += 70 * dt
    }
  }

  private buildSnapshot(): TowerSnapshot {
    const enemyFloor = this.currentEnemyFloor()
    const enemy = enemyFloor?.enemy ?? cloneEnemy(this.runtime.viewedFloor)
    const cost = reviveCost(this.runtime.viewedFloor)
    const nextSpawn = this.nextSpawnInfo()
    const spawnProgress = this.spawnProgressByKind()
    return {
      floor: this.runtime.viewedFloor,
      bestFloor: this.save.bestFloor,
      topFloor: topFloor(this.save),
      hp: this.save.hp,
      maxHp: this.save.maxHp,
      atk: this.save.atk,
      def: this.save.def,
      gold: this.save.gold,
      exp: 0,
      expToNext: 0,
      level: this.save.level,
      unspent: 0,
      speed: this.save.speed,
      paused: this.paused,
      phase: this.isDefeated() ? 'defeat' : 'advance',
      enemyName: enemy.name,
      enemyTitle: enemy.title,
      enemyIsBoss: enemy.isBoss,
      enemyHp: enemyFloor?.enemy?.hp ?? 0,
      enemyMaxHp: enemyFloor?.enemy?.maxHp ?? enemy.maxHp,
      heroLevels: this.save.heroLevels,
      unlockedSoldiers: this.unlockedKinds(),
      spawnProgressByKind: spawnProgress,
      nextSpawnKind: nextSpawn.kind,
      nextSpawnProgress: nextSpawn.progress,
      liveSoldiers: this.liveSoldiers().length,
      reviveCost: cost,
      canRevive: this.save.gold >= cost,
      defeated: this.isDefeated(),
    }
  }

  private emit(persist: boolean) {
    const due =
      persist ||
      this.runtime.time - this.lastHudEmit >= HUD_EMIT_INTERVAL ||
      this.paused ||
      this.isDefeated()
    if (due) {
      this.snapshot = this.buildSnapshot()
      this.lastHudEmit = this.runtime.time
      for (const listener of this.listeners) listener()
    }
    if (persist) this.schedulePersist()
  }

  private schedulePersist() {
    if (this.persistTimer) return
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = 0
      writeSave(this.userId, this.save)
    }, 220)
  }
}

export function useTowerGame(userId: string) {
  const ref = useRef<TowerEngine | null>(null)
  if (ref.current === null) ref.current = new TowerEngine(userId)
  const engine = ref.current
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)

  useEffect(() => () => engine.dispose(), [engine])

  return { engine, ...snap }
}
