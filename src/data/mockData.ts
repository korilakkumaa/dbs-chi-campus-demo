import type { GradeDeadline, SchoolClass, SemesterScores, Student, User, YearRecord } from '../types'
import {
  classNameToId,
  gradeNumberFromClassName,
  GRADE_LEVELS,
  gradeLabel,
  teacherWhitelist,
} from './teacherWhitelist'

/** Form classes: grades 7–9 × D S G P M L A J T R; 10–12 without R; plus G7–G10 EC. */
const CLASS_LETTERS = ['D', 'S', 'G', 'P', 'M', 'L', 'A', 'J', 'T', 'R'] as const
const GRADES = [7, 8, 9, 10, 11, 12] as const

function lettersForGrade(grade: number): readonly string[] {
  if (grade >= 10) return CLASS_LETTERS.filter((letter) => letter !== 'R')
  return CLASS_LETTERS
}

const formClasses: SchoolClass[] = GRADES.flatMap((grade) =>
  lettersForGrade(grade).map((letter) => ({
    id: classNameToId(`${grade}${letter}`),
    name: `${grade}${letter}`,
    grade: gradeLabel(grade),
    teacherId: null as string | null,
  })),
)

const ecClasses: SchoolClass[] = [7, 8, 9, 10].map((grade) => ({
  id: classNameToId(`G${grade} EC`),
  name: `G${grade} EC`,
  grade: gradeLabel(grade),
  teacherId: null as string | null,
}))

export const classes: SchoolClass[] = [...formClasses, ...ecClasses]

const teacherUsers: User[] = teacherWhitelist.map((t) => ({
  id: `u-${t.initial.toLowerCase()}`,
  username: t.email,
  password: 'campus',
  name: `${t.name}老師`,
  role: 'teacher',
  classIds: t.classes.map(classNameToId),
}))

/** Form classes get a single homeroom teacher; EC keeps the first listed lead. */
for (const t of teacherWhitelist) {
  const teacherId = `u-${t.initial.toLowerCase()}`
  for (const className of t.classes) {
    const cls = classes.find((c) => c.id === classNameToId(className))
    if (!cls) continue
    if (cls.teacherId == null) cls.teacherId = teacherId
  }
}

export const users: User[] = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'campus',
    name: '夏伊雲博士',
    role: 'admin',
    classIds: [],
  },
  {
    id: 'u-student',
    username: 'student',
    password: 'campus',
    name: '陳子軒',
    role: 'student',
    classIds: [],
  },
  ...teacherUsers,
]

const firstNames = [
  '子軒', '梓晴', '浩然', '詠詩', '俊傑', '嘉欣', '宇澤', '芯語',
  '天佑', '樂兒', '承恩', '詩涵', '家駿', '穎心', '卓霖', '凱婷',
  '銘軒', '依琳', '柏軒', '曉彤', '睿哲', '雅雯', '浩東', '安琪',
  '智傑', '凱琳', '俊熙', '詩雅', '明傑', '樂怡',
]

const lastNames = [
  '歐', '陳', '鄭', '張', '何', '葉', '郭', '林',
  '劉', '李', '梁', '馬', '吳', '潘', '譚',
  '鄧', '曾', '黃', '楊', '謝',
]

function pastClassLetter(seed: number, currentName: string): string {
  const form = currentName.match(/^(\d+)([A-Z])$/i)
  if (form) {
    const letter = form[2].toUpperCase()
    return letter === 'R' ? 'T' : letter
  }
  const letters = CLASS_LETTERS.filter((l) => l !== 'R')
  return letters[seed % letters.length]
}

function classNameForPastGrade(
  grade: number,
  currentName: string,
  seed: number,
): string {
  const currentGrade = gradeNumberFromClassName(currentName) ?? grade
  if (grade === currentGrade) return currentName
  const letter = pastClassLetter(seed, currentName)
  const safeLetter = grade >= 10 && letter === 'R' ? 'J' : letter
  return `${grade}${safeLetter}`
}

function makeSemesterScores(
  seed: number,
  grade: number,
  term: 1 | 2,
): SemesterScores {
  const base = 48 + ((seed * 11 + grade * 7 + term * 19) % 40)
  return {
    daily: Math.min(99, Math.max(35, base + ((seed + term) % 9) - 3)),
    reading: Math.min(99, Math.max(35, base + ((seed * 3 + grade) % 11) - 4)),
    writing: Math.min(99, Math.max(35, base + ((seed * 5 + term * 7) % 13) - 5)),
  }
}

function buildYearHistory(currentName: string, seed: number): YearRecord[] {
  const currentGrade = gradeNumberFromClassName(currentName) ?? 7
  const records: YearRecord[] = []
  for (let grade = 7; grade <= currentGrade; grade++) {
    records.push({
      grade,
      className: classNameForPastGrade(grade, currentName, seed),
      first: makeSemesterScores(seed, grade, 1),
      second: makeSemesterScores(seed, grade, 2),
    })
  }
  return records
}

function makeStudent(
  id: string,
  name: string,
  classId: string,
  classNumber: number,
  seed: number,
  className: string,
  overrides?: Partial<
    Pick<
      Student,
      | 'progress'
      | 'readingScore'
      | 'correctRate'
      | 'recentScores'
      | 'yearHistory'
      | 'strengths'
      | 'notes'
      | 'name'
    >
  >,
): Student {
  const progress = 55 + ((seed * 17) % 40)
  const readingScore = 50 + ((seed * 23) % 45)
  const correctRate = 48 + ((seed * 19) % 48)
  return {
    id,
    name,
    classId,
    classNumber,
    progress,
    readingScore,
    correctRate,
    recentScores: [
      { label: '小測一', score: 60 + ((seed * 3) % 35) },
      { label: '小測二', score: 58 + ((seed * 5) % 38) },
      { label: '期中試', score: 55 + ((seed * 11) % 40) },
      { label: '專題', score: 62 + ((seed * 13) % 33) },
    ],
    yearHistory: buildYearHistory(className, seed),
    strengths:
      seed % 3 === 0
        ? ['閱讀流暢', '課堂討論']
        : seed % 3 === 1
          ? ['解難能力', '毅力']
          : ['寫作', '同儕互助'],
    notes:
      seed % 2 === 0
        ? '本學期表現穩步提升。'
        : '在引導練習與回饋下反應良好。',
    ...overrides,
  }
}

/** Extreme fixtures for ring charts / meters — concentrated on FYC classes. */
const EXTREME_FIXTURES: {
  className: string
  classNumber: number
  name: string
  progress: number
  correctRate: number
  readingScore: number
  notes: string
  recentScores?: Student['recentScores']
}[] = [
  {
    className: '7D',
    classNumber: 1,
    name: '測零危急',
    progress: 0,
    correctRate: 0,
    readingScore: 0,
    notes: '極端測試：進度／答對率／閱讀皆為 0%。',
    recentScores: [
      { label: '小測一', score: 0 },
      { label: '小測二', score: 0 },
      { label: '期中試', score: 0 },
      { label: '專題', score: 0 },
    ],
  },
  {
    className: '7D',
    classNumber: 2,
    name: '測滿優秀',
    progress: 100,
    correctRate: 100,
    readingScore: 100,
    notes: '極端測試：全部指標滿分為 100%。',
    recentScores: [
      { label: '小測一', score: 100 },
      { label: '小測二', score: 100 },
      { label: '期中試', score: 100 },
      { label: '專題', score: 100 },
    ],
  },
  {
    className: '7D',
    classNumber: 3,
    name: '測危急邊',
    progress: 9,
    correctRate: 8,
    readingScore: 12,
    notes: '極端測試：落在危急區上緣（<10%）。',
  },
  {
    className: '7L',
    classNumber: 1,
    name: '測偏弱區',
    progress: 25,
    correctRate: 18,
    readingScore: 22,
    notes: '極端測試：偏弱區（10%–40%）。',
  },
  {
    className: '7L',
    classNumber: 2,
    name: '測高進低答',
    progress: 98,
    correctRate: 5,
    readingScore: 40,
    notes: '極端測試：進度極高但答對率極低。',
  },
  {
    className: '7L',
    classNumber: 3,
    name: '測低進高答',
    progress: 4,
    correctRate: 96,
    readingScore: 88,
    notes: '極端測試：進度極低但答對率極高。',
  },
  {
    className: '10S',
    classNumber: 1,
    name: '測一般區',
    progress: 55,
    correctRate: 52,
    readingScore: 50,
    notes: '極端測試：一般區中段（約 40%–70%）。',
  },
  {
    className: '10S',
    classNumber: 2,
    name: '測良好邊',
    progress: 70,
    correctRate: 71,
    readingScore: 68,
    notes: '極端測試：良好區下限（≥70%）。',
  },
  {
    className: '10S',
    classNumber: 3,
    name: '測近滿分',
    progress: 99,
    correctRate: 1,
    readingScore: 99,
    notes: '極端測試：進度近滿分、答對率近零。',
  },
]

export const students: Student[] = (() => {
  const list = classes.flatMap((cls, classIndex) => {
    const count = cls.name.includes('EC') ? 6 : 8
    return Array.from({ length: count }, (_, i) => {
      const seed = classIndex * 30 + i + 1
      const name = `${lastNames[(seed * 3) % lastNames.length]}${firstNames[seed % firstNames.length]}`
      return makeStudent(
        `s-${cls.id}-${i + 1}`,
        name,
        cls.id,
        i + 1,
        seed,
        cls.name,
      )
    })
  })

  for (const fixture of EXTREME_FIXTURES) {
    const classId = classNameToId(fixture.className)
    const target = list.find(
      (s) => s.classId === classId && s.classNumber === fixture.classNumber,
    )
    if (!target) continue
    target.name = fixture.name
    target.progress = fixture.progress
    target.correctRate = fixture.correctRate
    target.readingScore = fixture.readingScore
    target.notes = fixture.notes
    if (fixture.recentScores) target.recentScores = fixture.recentScores
    target.strengths = ['極端模擬數據']
  }

  return list
})()

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

export const seedGradeDeadlines: GradeDeadline[] = GRADE_LEVELS.map((grade) => {
  const defaults: Record<number, Partial<GradeDeadline>> = {
    7: {
      activityTitle: '閱讀分享會',
      activityDue: '2026-09-25',
    },
    8: {
      activityTitle: '書展參觀',
      activityDue: '2026-10-02',
    },
    9: {
      activityTitle: '',
      activityDue: '',
    },
    10: {
      activityTitle: '文學講座',
      activityDue: '2026-09-28',
    },
    11: {
      activityTitle: '專題簡報',
      activityDue: '2026-10-08',
    },
    12: {
      activityTitle: '畢業文集',
      activityDue: '2026-09-30',
    },
  }
  return {
    grade,
    readingDue: '',
    activityTitle: defaults[grade]?.activityTitle ?? '',
    activityDue: defaults[grade]?.activityDue ?? '',
    submitted: Boolean(defaults[grade]?.activityDue),
  }
})
