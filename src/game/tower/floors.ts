import type { Enemy, EnemyShape } from './types'
import { TOWER_EXCEL } from './excelData'

const MINIONS: { name: string; title: string; shape: EnemyShape }[] = [
  { name: '書蟲', title: '蠹簡橫行', shape: 'worm' },
  { name: '錯字小鬼', title: '魯魚亥豕', shape: 'imp' },
  { name: '墨漬精', title: '滿紙煙雲', shape: 'blob' },
  { name: '句讀妖', title: '點斷無憑', shape: 'ghost' },
  { name: '別字狐', title: '以訛傳訛', shape: 'fox' },
  { name: '斷簡殘篇', title: '闕文難補', shape: 'scroll' },
  { name: '考卷幽靈', title: '白卷夜遊', shape: 'ghost' },
  { name: '註疏傀儡', title: '章句為牢', shape: 'golem' },
  { name: '平仄精', title: '失黏落韻', shape: 'imp' },
]

const BOSSES: { name: string; title: string }[] = [
  { name: '八股文魔王', title: '制藝深淵' },
  { name: '科舉判官', title: '貢院夜試' },
  { name: '離騷之影', title: '澤畔行吟' },
  { name: '史家筆鋒', title: '直筆如刀' },
  { name: '文心雕龍', title: '體性之巔' },
]

export function isBossFloor(floor: number) {
  return floor > 0 && floor % 10 === 0
}

export function enemyMeta(floor: number) {
  const category =
    TOWER_EXCEL.monsterCategories[(floor - 1) % TOWER_EXCEL.monsterCategories.length]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const enemyCategory = category as Enemy['category']
  if (isBossFloor(floor)) {
    const cycle = Math.floor((floor - 1) / 10)
    const base = BOSSES[cycle % BOSSES.length]
    const round = Math.floor(cycle / BOSSES.length)
    return {
      name: round > 0 ? `${base.name}·再臨` : base.name,
      title: base.title,
      shape: 'boss' as const,
      isBoss: true,
      category: enemyCategory,
    }
  }
  const minion = MINIONS[(floor - 1) % MINIONS.length]
  return { ...minion, isBoss: false, category: enemyCategory }
}

export function makeEnemy(floor: number): Enemy {
  const meta = enemyMeta(floor)
  const boss = meta.isBoss
  const hp = Math.round((22 + floor * 9) * (boss ? 2.4 : 1))
  const atk = Math.round((5 + floor * 1.35) * (boss ? 1.35 : 1))
  return {
    name: meta.name,
    title: meta.title,
    isBoss: boss,
    shape: meta.shape,
    category: meta.category,
    hp,
    maxHp: hp,
    atk,
  }
}
