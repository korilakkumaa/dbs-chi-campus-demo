import type { EnemyShape } from './types'

export const PX = {
  ink: '#1a1410',
  paper: '#f4ead8',
  cream: '#e4d2b8',
  brick: '#6b4332',
  brickDk: '#4a2e24',
  mortar: '#2e1d16',
  plank: '#8a5a32',
  plankLt: '#c4a07a',
  night: '#1a2430',
  sky: '#243444',
  star: '#e8d8c6',
  window: '#1a2430',
  glow: '#e8c878',
  bossWin: '#c45a3a',
  amber: '#b8682a',
  amberDk: '#8a4a1a',
  forest: '#355447',
  clay: '#c45a3a',
  gold: '#e8c878',
}

export function snap(n: number) {
  return Math.round(n)
}

export function pxFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(snap(x), snap(y), Math.max(1, snap(w)), Math.max(1, snap(h)))
}

type Sheet = { rows: string[]; colors: Record<string, string> }

const C = {
  k: '#1a1410',
  w: '#f4ead8',
  n: '#6b4332',
  m: '#3d281f',
  r: '#9a3b2a',
  o: '#c45a3a',
  a: '#b8682a',
  y: '#e8c878',
  g: '#355447',
  s: '#8a9aa4',
  d: '#5c5044',
  u: '#c4b49a',
  p: '#d8e0e6',
  i: '#2a3a48',
  f: '#c47a3a',
  b: '#3a2a48',
  e: '#6a7a88',
}

const ENEMIES: Record<EnemyShape, Sheet> = {
  worm: {
    colors: C,
    rows: [
      '................',
      '................',
      '..nn..nn..nn....',
      '.nmmnnmmnnmmn...',
      'nmaamaamaamam...',
      'nmmnnmmnnmmnk...',
      '.nkk..nkk..n....',
      '................',
    ],
  },
  imp: {
    colors: C,
    rows: [
      '......r.r.......',
      '......rrr.......',
      '.....roror......',
      '.....rrrrr......',
      '....rrkkrrr.....',
      '....rrrrrrr.....',
      '......rrr.......',
      '.....rr.rr......',
      '....rr...rr.....',
      '....kk...kk.....',
    ],
  },
  blob: {
    colors: C,
    rows: [
      '......ii........',
      '....iiiiii......',
      '...iiiiiiii.....',
      '..iiwiwiiiii....',
      '..iiiiiiiiii....',
      '...iiiiiiii.....',
      '....iiiiii......',
      '.....iiii.......',
    ],
  },
  ghost: {
    colors: C,
    rows: [
      '.....ppp........',
      '....ppppp.......',
      '...ppkpkpp......',
      '...ppppppp......',
      '...ppppppp......',
      '...ppppppp......',
      '...pp.pp.pp.....',
      '....p..p..p.....',
    ],
  },
  fox: {
    colors: C,
    rows: [
      '..f...f.........',
      '..ff.ff.........',
      '...fff..........',
      '...fkf..........',
      '...fff..........',
      '..fffff.........',
      '...f.f..........',
      '...k.k..........',
    ],
  },
  scroll: {
    colors: C,
    rows: [
      '..yyyyyyyyyy....',
      '..yuuuuuuuuy....',
      '..yuakaaauuy....',
      '..yuuuuuuuuy....',
      '..yuakaaauuy....',
      '..yuuuuuuuuy....',
      '..yyyyyyyyyy....',
      '................',
    ],
  },
  golem: {
    colors: C,
    rows: [
      '.....ssss.......',
      '....ssssss......',
      '....skssks......',
      '...ssssssss.....',
      '...ssddddss.....',
      '...ssssssss.....',
      '....ss..ss......',
      '....dd..dd......',
    ],
  },
  boss: {
    colors: C,
    rows: [
      '......yy........',
      '.....yyyy.......',
      '....bbyybb......',
      '...bbbkbbbb.....',
      '...brbkbrbb.....',
      '...bbbbbbbb.....',
      '..bbbbbbbbbb....',
      '..bb......bb....',
      '..yy......yy....',
      '..kk......kk....',
    ],
  },
}

export function blitSheet(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  x: number,
  y: number,
  pixel: number,
  flip: boolean,
) {
  const h = sheet.rows.length
  const w = sheet.rows[0]?.length ?? 0
  const size = Math.max(1, snap(pixel))
  ctx.save()
  ctx.translate(snap(x), snap(y))
  if (flip) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  const ox = -Math.floor((w * size) / 2)
  const oy = -h * size
  for (let j = 0; j < h; j++) {
    const row = sheet.rows[j]
    for (let i = 0; i < w; i++) {
      const color = sheet.colors[row[i]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + i * size, oy + j * size, size, size)
    }
  }
  ctx.restore()
}

export function enemySheet(shape: EnemyShape) {
  return ENEMIES[shape]
}

export function drawPixelHp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
) {
  const barW = snap(w)
  const barH = 5
  const left = snap(x - barW / 2)
  const top = snap(y)
  pxFill(ctx, left, top, barW, barH, '#1a1410')
  pxFill(ctx, left + 1, top + 1, barW - 2, barH - 2, '#3a2030')
  const fill = Math.max(0, Math.round((barW - 2) * Math.min(1, Math.max(0, ratio))))
  // Magenta/pink bars like the reference idle tower UI.
  const tone = ratio > 0.35 ? '#e85a8a' : '#c45a3a'
  if (fill > 0) pxFill(ctx, left + 1, top + 1, fill, barH - 2, tone)
}

let gradedSpriteCanvas: HTMLCanvasElement | null = null
let gradedSpriteCtx: CanvasRenderingContext2D | null = null

function gradedSpriteCtxFor(w: number, h: number) {
  if (!gradedSpriteCanvas) {
    gradedSpriteCanvas = document.createElement('canvas')
    gradedSpriteCtx = gradedSpriteCanvas.getContext('2d')
  }
  if (!gradedSpriteCtx) return null
  if (gradedSpriteCanvas.width !== w || gradedSpriteCanvas.height !== h) {
    gradedSpriteCanvas.width = w
    gradedSpriteCanvas.height = h
  }
  gradedSpriteCtx.setTransform(1, 0, 0, 1, 0, 0)
  gradedSpriteCtx.clearRect(0, 0, w, h)
  return gradedSpriteCtx
}

/** Grade a sprite into the tower palette and blit with pixel-crisp scaling. */
export function drawGradedSprite(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flip: boolean,
) {
  const w = Math.max(1, snap(dw))
  const h = Math.max(1, snap(dh))
  const g = gradedSpriteCtxFor(w, h)
  if (!g) return

  g.save()
  g.imageSmoothingEnabled = false
  if (flip) {
    g.translate(w, 0)
    g.scale(-1, 1)
  }
  g.filter = 'sepia(0.55) saturate(0.55) brightness(0.86) contrast(1.12)'
  g.drawImage(sheet, sx, sy, sw, sh, 0, 0, w, h)
  g.filter = 'none'

  g.globalCompositeOperation = 'multiply'
  g.fillStyle = PX.plankLt
  g.globalAlpha = 0.42
  g.fillRect(0, 0, w, h)
  g.globalAlpha = 1

  g.globalCompositeOperation = 'color'
  g.fillStyle = PX.cream
  g.globalAlpha = 0.14
  g.fillRect(0, 0, w, h)
  g.globalAlpha = 1

  const floorShade = g.createLinearGradient(0, h * 0.35, 0, h)
  floorShade.addColorStop(0, 'rgba(26, 20, 16, 0)')
  floorShade.addColorStop(0.55, 'rgba(46, 29, 22, 0.18)')
  floorShade.addColorStop(1, 'rgba(26, 20, 16, 0.42)')
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = floorShade
  g.fillRect(0, 0, w, h)

  const topGlow = g.createLinearGradient(0, 0, 0, h * 0.55)
  topGlow.addColorStop(0, 'rgba(232, 200, 120, 0.1)')
  topGlow.addColorStop(1, 'rgba(232, 200, 120, 0)')
  g.globalCompositeOperation = 'soft-light'
  g.fillStyle = topGlow
  g.fillRect(0, 0, w, h)
  g.restore()

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(gradedSpriteCanvas!, snap(dx), snap(dy), w, h)
  ctx.restore()
}

export function drawHeroPlatformShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  platformY: number,
  layerOffset: number,
  width: number,
) {
  const heightT = Math.max(0, Math.min(1, layerOffset / 0.16))
  const cx = snap(x)
  const cy = snap(platformY) + 3
  const rx = Math.max(8, snap(width * (0.56 - heightT * 0.12)))
  const ry = Math.max(2, snap(3 - heightT * 0.8))
  const alpha = 0.5 - heightT * 0.22

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = PX.ink
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.45
  ctx.fillStyle = PX.mortar
  ctx.beginPath()
  ctx.ellipse(cx, cy + 1, rx + 1, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  pxFill(ctx, cx - 2, snap(platformY), 4, 2, PX.plankLt)
  pxFill(ctx, cx - 1, snap(platformY) + 1, 2, 1, PX.plank)
}
