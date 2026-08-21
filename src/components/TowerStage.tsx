import { useEffect, useRef } from 'react'
import {
  HERO_FRAME_H,
  HERO_FRAME_W,
  HERO_IDLE_FRAME,
  HERO_SHEET_URL,
} from '../game/tower/heroSprite'
import { FIXED_TIMESTEP, MAX_FRAME_STEPS } from '../game/tower/config'
import { HERO_KIND_CATALOG } from '../game/tower/heroes'
import { lane } from '../game/tower/layout'
import { drawGradedSprite, drawHeroPlatformShadow, drawPixelHp, pxFill, PX, snap } from '../game/tower/pixel'
import { enemySpritePack } from '../game/tower/enemySprite'
import type { TowerEngine } from '../game/tower/useTowerGame'
import type { FloorState, SoldierState, TowerRuntime } from '../game/tower/types'

const witchSheet = new Image()
witchSheet.decoding = 'async'
witchSheet.src = HERO_SHEET_URL

const skyNightSheet = new Image()
skyNightSheet.decoding = 'async'
skyNightSheet.src = new URL('../assets/tower/sky-night.png', import.meta.url).href

const floorBgSheet = new Image()
floorBgSheet.decoding = 'async'
floorBgSheet.src = new URL('../assets/tower/floor-background.png', import.meta.url).href

type FloorBgCrop = {
  ready: boolean
  canvas: HTMLCanvasElement | null
  w: number
  h: number
}

const floorBgCrop: FloorBgCrop = {
  ready: false,
  canvas: null,
  w: 300,
  h: 280,
}

function isNearBlack(r: number, g: number, b: number, a: number) {
  return a < 16 || (r < 22 && g < 22 && b < 22)
}

floorBgSheet.onload = () => {
  const w = floorBgSheet.naturalWidth
  const h = floorBgSheet.naturalHeight
  const full = document.createElement('canvas')
  full.width = w
  full.height = h
  const fctx = full.getContext('2d')
  if (!fctx) return
  fctx.imageSmoothingEnabled = false
  fctx.drawImage(floorBgSheet, 0, 0)
  const data = fctx.getImageData(0, 0, w, h)
  const px = data.data

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      const a = px[i + 3]!
      if (isNearBlack(r, g, b, a)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) {
    floorBgCrop.canvas = full
    floorBgCrop.w = w
    floorBgCrop.h = h
    floorBgCrop.ready = true
    return
  }

  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const cropped = document.createElement('canvas')
  cropped.width = cw
  cropped.height = ch
  const cctx = cropped.getContext('2d')
  if (!cctx) return
  cctx.imageSmoothingEnabled = false
  cctx.drawImage(full, minX, minY, cw, ch, 0, 0, cw, ch)
  floorBgCrop.canvas = cropped
  floorBgCrop.w = cw
  floorBgCrop.h = ch
  floorBgCrop.ready = true
}

if (floorBgSheet.complete && floorBgSheet.naturalWidth > 0) {
  floorBgSheet.onload?.(new Event('load'))
}

function drawFloorNumber(
  ctx: CanvasRenderingContext2D,
  towerLeft: number,
  towerW: number,
  platformY: number,
  band: number,
  floorNum: number,
) {
  const size = Math.max(28, Math.round(band * 0.72))
  const midX = snap(towerLeft + towerW / 2)
  const midY = snap(platformY - band * 0.48)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${size}px "GenRyu Min", "Songti TC", serif`
  ctx.fillStyle = 'rgba(55, 62, 78, 0.22)'
  ctx.fillText(String(floorNum), midX, midY)
  ctx.restore()
}

function heroFrameIndex(_soldier: SoldierState) {
  return HERO_IDLE_FRAME
}

function heroMotionOffset(soldier: SoldierState, band: number) {
  const dir = lane(soldier.floor)
  const lungeLean =
    soldier.state === 'lunging'
      ? dir * band * 0.045 * Math.min(1, soldier.t * 5)
      : 0
  const impactPull =
    soldier.state === 'impact'
      ? -dir * band * 0.055 * Math.sin(Math.min(1, soldier.t) * Math.PI)
      : 0
  const recoilHop = soldier.state === 'recoil' ? -soldier.y * band * 0.18 : 0
  return {
    x: lungeLean + impactPull,
    y: recoilHop,
  }
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  platformY: number,
  layerOffset: number,
  soldier: SoldierState,
  actorH: number,
  band: number,
) {
  const kind = HERO_KIND_CATALOG[soldier.kind]
  const drawH = Math.max(16, snap(actorH * kind.scale))
  const drawW = drawH
  const frame = heroFrameIndex(soldier)
  const motion = heroMotionOffset(soldier, band)
  const liftPx = layerOffset * band
  const drawX = snap(x) + snap(motion.x)
  const drawY = snap(platformY - liftPx) + snap(motion.y)
  const left = drawX - Math.floor(drawW / 2)
  const top = drawY - drawH + 4

  drawHeroPlatformShadow(ctx, drawX, platformY, layerOffset, drawW)

  if (witchSheet.complete && witchSheet.naturalWidth > 0) {
    drawGradedSprite(
      ctx,
      witchSheet,
      frame * HERO_FRAME_W,
      0,
      HERO_FRAME_W,
      HERO_FRAME_H,
      left,
      top,
      drawW,
      drawH,
      soldier.facing < 0,
    )
  }
  return drawH
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  floor: FloorState,
  actorH: number,
) {
  if (!floor.enemy) return
  const dir = lane(floor.floor)
  const pack = enemySpritePack(floor.enemy.shape)
  if (!pack.source || !pack.ready) return

  const scale = floor.enemy.isBoss ? 1.28 : 1
  const drawH = Math.max(18, snap(actorH * scale))
  const aspect = pack.contentW / Math.max(1, pack.contentH)
  const drawW = Math.max(12, snap(drawH * aspect))
  const left = snap(x) - Math.floor(drawW / 2)
  const top = snap(y) - drawH

  drawHeroPlatformShadow(ctx, snap(x), snap(y), 0.02, drawW)
  drawGradedSprite(
    ctx,
    pack.source,
    0,
    0,
    pack.contentW,
    pack.contentH,
    left,
    top,
    drawW,
    drawH,
    dir < 0,
  )
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, _cameraTop: number) {
  const sw = skyNightSheet.naturalWidth
  const sh = skyNightSheet.naturalHeight
  if (skyNightSheet.complete && sw > 0 && sh > 0) {
    // Cover the stage; bias slightly upward so the moon stays in the upper half.
    const scale = Math.max(w / sw, h / sh)
    const dw = Math.ceil(sw * scale)
    const dh = Math.ceil(sh * scale)
    const dx = Math.round((w - dw) / 2)
    const dy = Math.round((h - dh) / 2 - Math.max(0, dh - h) * 0.12)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(skyNightSheet, dx, dy, dw, dh)
    ctx.restore()
    return
  }

  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#2a1a48')
  g.addColorStop(0.5, '#1a1438')
  g.addColorStop(1, '#0e0a24')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawFloorBackground(
  ctx: CanvasRenderingContext2D,
  towerLeft: number,
  towerW: number,
  platformY: number,
  band: number,
) {
  const left = snap(towerLeft)
  const width = snap(towerW)
  const top = snap(platformY - band)
  const height = Math.max(1, snap(band - 12))

  const src = floorBgCrop.ready && floorBgCrop.canvas ? floorBgCrop.canvas : null
  const srcW = floorBgCrop.ready ? floorBgCrop.w : floorBgSheet.naturalWidth
  const srcH = floorBgCrop.ready ? floorBgCrop.h : floorBgSheet.naturalHeight
  const hasArt = (src || (floorBgSheet.complete && floorBgSheet.naturalWidth > 0)) && srcW && srcH

  if (!hasArt) {
    // Fallback only while the asset loads — keep original warm brick tone.
    pxFill(ctx, left, top, width, height, '#8a5a3a')
    return
  }

  // Draw the floor art at full opacity so terracotta / cream columns keep their color.
  const scale = width / srcW
  const srcVisibleH = Math.min(srcH, height / scale)
  const srcY = Math.max(0, Math.min(srcH - srcVisibleH, srcH * 0.08))
  const drawH = Math.round(srcVisibleH * scale)

  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, width, height)
  ctx.clip()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src ?? floorBgSheet, 0, srcY, srcW, srcVisibleH, left, top, width, drawH)
  // Fill any leftover band below the art with a matching warm tone (not beige wash).
  if (drawH < height) {
    pxFill(ctx, left, top + drawH, width, height - drawH, '#6e4632')
  }
  ctx.restore()
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  h: number,
  towerLeft: number,
  towerW: number,
  floors: FloorState[],
  band: number,
  floorOffset: number,
) {
  const floorBase = h - 22
  pxFill(ctx, towerLeft, 8, towerW, h - 8, '#6e4632')

  for (const floor of floors) {
    const platformY = floorBase - (floor.floor - floorOffset) * band
    if (platformY < -band || platformY > h + band) continue
    drawFloorBackground(ctx, towerLeft, towerW, platformY, band)
    drawFloorNumber(ctx, towerLeft, towerW, platformY, band, floor.floor)
    // Thick beam / platform like the reference
    pxFill(ctx, towerLeft, platformY, towerW, 12, '#6b5a48')
    pxFill(ctx, towerLeft, platformY, towerW, 3, '#8a7460')
    pxFill(ctx, towerLeft, platformY + 10, towerW, 2, '#4a3c30')
  }

  pxFill(ctx, towerLeft, 8, 5, h - 8, '#9a9080')
  pxFill(ctx, towerLeft + towerW - 5, 8, 5, h - 8, '#9a9080')
}

function drawFx(ctx: CanvasRenderingContext2D, w: number, h: number, runtime: TowerRuntime) {
  ctx.save()
  ctx.font = '700 12px "PingFang TC", "Noto Sans TC", sans-serif'
  ctx.textAlign = 'center'
  for (const f of runtime.floaters) {
    if (f.life <= 0) continue
    ctx.globalAlpha = Math.min(1, f.life / (f.maxLife * 0.4))
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x * w, f.y * h)
  }
  ctx.globalAlpha = 1
  for (const p of runtime.particles) {
    if (p.life <= 0) continue
    ctx.globalAlpha = p.life / p.maxLife
    pxFill(ctx, p.x * w, p.y * h, Math.max(2, p.size), Math.max(2, p.size), p.color)
  }
  ctx.restore()
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  engine: TowerEngine,
  alpha: number,
) {
  const { save, runtime } = engine
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)

  const allFloors = [...save.floors].sort((a, b) => a.floor - b.floor)
  // ~80–85% tower width like the reference idle climber.
  const towerW = Math.round(Math.min(w * 0.84, Math.max(200, w - 28)))
  const towerLeft = Math.round((w - towerW) / 2)
  const availableH = h - 36
  const visibleCount = 4
  const band = Math.max(72, Math.floor(availableH / visibleCount))
  const cameraTop = engine.renderCamera(alpha)
  const visibleBottom = cameraTop - (visibleCount - 1)
  const floorMap = new Map<number, FloorState>(allFloors.map((f) => [f.floor, f]))
  const visibleFloors: FloorState[] = Array.from({ length: visibleCount }, (_, i) => {
    const floorNum = Math.max(1, Math.ceil(visibleBottom) + i)
    return (
      floorMap.get(floorNum) ?? {
        floor: floorNum,
        enemy: null,
        respawnIn: 0,
        cleared: false,
      }
    )
  })
  // Characters ~40–45% of floor band height.
  const heroH = Math.max(22, Math.floor(band * 0.42))
  const enemyH = Math.max(24, Math.floor(band * 0.46))
  const floorBase = h - 22

  drawBackdrop(ctx, w, h, cameraTop)
  drawTower(ctx, h, towerLeft, towerW, visibleFloors, band, visibleBottom)

  for (const floor of visibleFloors) {
    const platformY = floorBase - (floor.floor - visibleBottom) * band
    if (platformY < 10 || platformY > h + 20) continue
    const enemyX = towerLeft + towerW * (lane(floor.floor) > 0 ? 0.72 : 0.28)
    if (floor.enemy) {
      drawEnemy(ctx, enemyX, platformY, floor, enemyH)
      const er = floor.enemy.maxHp === 0 ? 0 : floor.enemy.hp / floor.enemy.maxHp
      drawPixelHp(ctx, snap(enemyX), snap(platformY - enemyH - 4), Math.max(28, Math.floor(enemyH * 0.7)), er)
    }
  }

  for (const soldier of save.soldiers.filter((s) => s.state !== 'dead')) {
    const pos = engine.renderSoldier(soldier.id, alpha)
    const worldY = pos?.worldY ?? engine.soldierRenderWorldY(soldier)
    const floorNum = Math.floor(worldY)
    const layerOffset = worldY - floorNum
    const platformY = floorBase - (floorNum - visibleBottom) * band
    if (platformY < 10 || platformY > h + 20) continue
    const sx = towerLeft + towerW * (pos?.x ?? soldier.x)
    const motion = heroMotionOffset(soldier, band)
    const drawnH = drawHero(ctx, sx, platformY, layerOffset, soldier, heroH, band)
    const ratio = soldier.maxHp === 0 ? 0 : soldier.hp / soldier.maxHp
    const liftPx = layerOffset * band
    drawPixelHp(
      ctx,
      snap(sx) + snap(motion.x),
      snap(platformY - liftPx - drawnH - 6) + snap(motion.y),
      Math.max(26, Math.floor(heroH * 0.65)),
      ratio,
    )
  }

  if (engine.paused && save.hp > 0) {
    ctx.fillStyle = 'rgba(26, 20, 16, 0.42)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = PX.paper
    ctx.font = '700 22px "GenRyu Min", "Songti TC", serif'
    ctx.textAlign = 'center'
    ctx.fillText('暫停', w / 2, h * 0.46)
  }
  if (save.hp <= 0) {
    ctx.fillStyle = 'rgba(26, 20, 16, 0.4)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = PX.clay
    ctx.font = '700 22px "GenRyu Min", "Songti TC", serif'
    ctx.textAlign = 'center'
    ctx.fillText('力有未逮', w / 2, h * 0.42)
  }

  drawFx(ctx, w, h, runtime)
}

export function TowerStage({ engine }: { engine: TowerEngine }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = true
    let last = performance.now()
    let accumulator = 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    engine.setReducedMotion(reduce.matches)

    const onReduce = () => engine.setReducedMotion(reduce.matches)
    reduce.addEventListener('change', onReduce)

    const fit = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
    }

    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    fit()

    const loop = (now: number) => {
      if (!running) return
      raf = window.requestAnimationFrame(loop)
      if (document.hidden) {
        last = now
        accumulator = 0
        return
      }
      const frameDt = Math.min(0.25, (now - last) / 1000)
      last = now
      accumulator += frameDt

      let steps = 0
      while (accumulator >= FIXED_TIMESTEP && steps < MAX_FRAME_STEPS) {
        engine.beginFixedStep()
        engine.step(FIXED_TIMESTEP)
        accumulator -= FIXED_TIMESTEP
        steps += 1
      }
      if (steps >= MAX_FRAME_STEPS) accumulator = 0

      const alpha = accumulator / FIXED_TIMESTEP
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = canvas.width / dpr
      const ch = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      drawScene(ctx, cw, ch, engine, alpha)
    }
    raf = window.requestAnimationFrame(loop)

    const onVis = () => {
      last = performance.now()
      accumulator = 0
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      window.cancelAnimationFrame(raf)
      ro.disconnect()
      reduce.removeEventListener('change', onReduce)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [engine])

  return (
    <div ref={wrapRef} className="tower-stage">
      <canvas ref={canvasRef} className="tower-canvas" />
    </div>
  )
}
