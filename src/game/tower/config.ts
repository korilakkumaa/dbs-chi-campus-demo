/**
 * Tunable tower constants. Change these to restabilize layout without
 * hunting through drawing / combat code.
 *
 * Distances in 0–1 are fractions of tower width (left wall → right wall).
 */

/** CSS pixels. Narrow enough for a 320px phone after page chrome. */
export const TOWER_WIDTH = 280

/** Side gutter so the tower never kisses the canvas edge. */
export const TOWER_SIDE_PAD = 12

/** Standing inset from each wall for hero / enemy. */
export const LANE_FROM_EDGE = 0.28

/** Spacing between party members, as a fraction of tower width. */
export const PARTY_SPACING = 0.1

/**
 * Top of the stairs, measured from the wall they cling to.
 * Odd floors: right wall. Even floors: left wall.
 */
export const STAIR_FROM_EDGE = 0.08

/** Bottom landing, how far the stairs jut into the room. */
export const STAIR_SPAN = 0.22

/** Pause on the landing before walking up. */
export const STAIR_PAUSE_SEC = 0.2

/** Hero height as a fraction of one floor band. Smaller = tinier attacker. */
export const HERO_HEIGHT_RATIO = 0.4

/** Enemy height as a fraction of one floor band. */
export const ENEMY_HEIGHT_RATIO = 0.5

/**
 * Attacker walk speed. 1.00 is the baseline.
 * 0.80 = slower stride, 1.25 = quicker.
 */
export const HERO_WALK_SPEED = 0.5

/** Climb speed. 1.00 is the baseline (walk-to-stairs + going up). */
export const HERO_CLIMB_SPEED = 0.5

/**
 * Attacker kind: 'scholar' | 'poet' | 'page'
 * 書生均衡、墨客偏攻、書僮較小較弱。
 */
export const HERO_KIND: 'scholar' | 'poet' | 'page' = 'scholar'

/** How many attackers can stand on the floor (1–4). Extra ones spawn over time. */
export const HERO_COUNT = 3

/**
 * Attacker spawn speed. 1.00 is the baseline (one new attacker every few seconds
 * until HERO_COUNT). 2.00 = twice as fast.
 */
export const HERO_SPAWN_SPEED = 1.0

/** Seconds between spawns when HERO_SPAWN_SPEED is 1.00. */
export const HERO_SPAWN_SEC = 4.5

/** Base gold cost to upgrade attackers. Next cost = this × (level + 1). */
export const HERO_UPGRADE_COST = 28

/**
 * Enemy HP regen speed. 1.00 = one tick per second.
 * 0 = no regen.
 */
export const ENEMY_REGEN_SPEED = 1.0

/** Fraction of max HP restored each regen tick. 0.02 = 2%. */
export const ENEMY_REGEN_PERCENT = 0.02

/** Normalized tower-x covered per second when HERO_WALK_SPEED is 1.00. */
export const HERO_WALK_X_PER_SEC = 0.48

/** Knockback after a hit, in tower-x. */
export const RECOIL_DISTANCE = 0.12

/** Start this far off-screen (in lane direction) when first walking in. */
export const APPROACH_START = 0.16

/** Seconds to climb one floor vertically at 1× game speed. */
export const CLIMB_LIFT_SEC = 1.05

/** Seconds for the camera to settle onto the next floor. */
export const CLIMB_CAM_SEC = 0.28

/** Floor numeral size as a fraction of the floor band. */
export const FLOOR_NUM_RATIO = 0.58

/** Logic tick rate (seconds). Render interpolates between ticks. */
export const FIXED_TIMESTEP = 1 / 60

/** Max fixed steps per animation frame — avoids spiral-of-death after tab switch. */
export const MAX_FRAME_STEPS = 5

/** Walk accel / decel as multiples of max walk rate (tower-x per second). */
export const MOVE_ACCEL_MUL = 3.5
export const MOVE_DECEL_MUL = 4.5

/** Default hover height within a floor band (0 = platform, 1 = full band). */
export const FLY_Y_BASE = 0.04

/** Min / max hover offset — keeps the witch inside the current layer. */
export const FLY_Y_MIN = 0.02
export const FLY_Y_MAX = 0.1

/** Hover sine amplitude and frequency (Hz). */
export const FLY_HOVER_AMP = 0.022
export const FLY_HOVER_HZ = 0.38

/** Seconds to ease flyY toward the hover target. */
export const FLY_HOVER_TAU = 0.72
