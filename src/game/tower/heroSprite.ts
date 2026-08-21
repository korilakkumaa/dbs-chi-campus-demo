export const HERO_SHEET_URL = new URL(
  '../../assets/tower/witch-broom.png',
  import.meta.url,
).href

export const HERO_FRAME_W = 100
export const HERO_FRAME_H = 100
export const HERO_FRAME_COUNT = 1
export const HERO_WALK_FRAME_COUNT = 1
export const HERO_IDLE_FRAME = 0
export const HERO_HIT_X = 0.33
/** Normalized tower-x traveled per walk-frame advance. */
export const HERO_WALK_FRAME_WIDTH = 0.045
/** Distance (normalized x) between walk frames — two cycles to reach the enemy. */
export const HERO_STRIDE = HERO_HIT_X / 8
