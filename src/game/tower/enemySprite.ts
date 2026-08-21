import type { EnemyShape } from './types'

export const ENEMY_GOBLIN_A_URL = new URL(
  '../../assets/tower/enemy-goblin-a.png',
  import.meta.url,
).href

export const ENEMY_GOBLIN_B_URL = new URL(
  '../../assets/tower/enemy-goblin-b.png',
  import.meta.url,
).href

export const ENEMY_SPRITE_SIZE = 130

export type EnemySpritePack = {
  ready: boolean
  source: CanvasImageSource | null
  /** Cropped content width in source pixels. */
  contentW: number
  /** Cropped content height in source pixels. */
  contentH: number
}

/** Which goblin art to use for each enemy shape. */
export function enemySpriteKind(shape: EnemyShape): 'a' | 'b' {
  if (shape === 'boss' || shape === 'golem' || shape === 'fox' || shape === 'imp') return 'b'
  return 'a'
}

function loadTransparentSprite(url: string): EnemySpritePack {
  const img = new Image()
  img.decoding = 'async'
  const canvas = document.createElement('canvas')
  const pack: EnemySpritePack = {
    ready: false,
    source: null,
    contentW: ENEMY_SPRITE_SIZE,
    contentH: ENEMY_SPRITE_SIZE,
  }

  img.onload = () => {
    const w = img.naturalWidth || ENEMY_SPRITE_SIZE
    const h = img.naturalHeight || ENEMY_SPRITE_SIZE
    const full = document.createElement('canvas')
    full.width = w
    full.height = h
    const fctx = full.getContext('2d')
    if (!fctx) return
    fctx.imageSmoothingEnabled = false
    fctx.drawImage(img, 0, 0)
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
        // Key out near-black export background.
        if (r < 18 && g < 18 && b < 18) {
          px[i + 3] = 0
          continue
        }
        if (px[i + 3]! < 16) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    fctx.putImageData(data, 0, 0)

    if (maxX < minX || maxY < minY) {
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')?.drawImage(full, 0, 0)
      pack.contentW = w
      pack.contentH = h
    } else {
      const cw = maxX - minX + 1
      const ch = maxY - minY + 1
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(full, minX, minY, cw, ch, 0, 0, cw, ch)
      pack.contentW = cw
      pack.contentH = ch
    }

    pack.source = canvas
    pack.ready = true
  }
  img.src = url

  return pack
}

const goblinA = loadTransparentSprite(ENEMY_GOBLIN_A_URL)
const goblinB = loadTransparentSprite(ENEMY_GOBLIN_B_URL)

export function enemySpritePack(shape: EnemyShape): EnemySpritePack {
  return enemySpriteKind(shape) === 'b' ? goblinB : goblinA
}

export function enemySpriteSource(shape: EnemyShape): CanvasImageSource | null {
  return enemySpritePack(shape).source
}
