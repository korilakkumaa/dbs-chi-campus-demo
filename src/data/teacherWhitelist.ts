/** 2627 Teacher White List — embedded for the campus demo. */
export interface WhitelistTeacher {
  initial: string
  name: string
  email: string
  classes: string[]
}

export const teacherWhitelist: WhitelistTeacher[] = [
  { initial: 'FYC', name: '朱鳳儀', email: 'dbsfyc@dbs.edu.hk', classes: ['7D', '7L', '10S'] },
  { initial: 'LKL', name: '林麗君', email: 'dbslkl@dbs.edu.hk', classes: ['7S', '11G'] },
  { initial: 'YLN', name: '吳綺琳', email: 'dbsyln@dbs.edu.hk', classes: ['7P', '7J', 'G9 EC', '12L'] },
  { initial: 'HNY', name: '袁軒妮', email: 'dbshny@dbs.edu.hk', classes: ['7G', '12J'] },
  { initial: 'THW', name: '黃子軒', email: 'dbsthw@dbs.edu.hk', classes: ['7M', '9M', '9R'] },
  { initial: 'LWW', name: '胡麗華', email: 'dbslww@dbs.edu.hk', classes: ['7A', 'G8 EC', '11S', '12P'] },
  { initial: 'LWT', name: '曾麗雲', email: 'dbslwt@dbs.edu.hk', classes: ['7R', '7T', '11M'] },
  { initial: 'WKL', name: '王家朗', email: 'dbswkl@dbs.edu.hk', classes: ['G7 EC', 'G9 EC', 'G10 EC', '12T'] },
  { initial: 'TWL', name: '梁芷蘊', email: 'dbstwl@dbs.edu.hk', classes: ['8S', '10D', '12D'] },
  { initial: 'LL', name: '李寶玲', email: 'dbsll@dbs.edu.hk', classes: ['8D', '8L', '11T'] },
  { initial: 'KYL', name: '黎嘉恩', email: 'dbskyl@dbs.edu.hk', classes: ['8G', '8R', '10L'] },
  { initial: 'CHUC', name: '陳振翔', email: 'dbschuc@dbs.edu.hk', classes: ['8P', '8M', '11A'] },
  { initial: 'TCM', name: '馬太初', email: 'dbstcm@dbs.edu.hk', classes: ['8A'] },
  { initial: 'YCN', name: '吳燕青', email: 'dbsycn@dbs.edu.hk', classes: ['8J', '9A', '10A'] },
  { initial: 'KSM', name: '陳詩敏', email: 'dbsksm@dbs.edu.hk', classes: ['8T', 'G9 EC', '10J', '12M'] },
  { initial: 'SHC', name: '周倩嫻', email: 'dbsshc@dbs.edu.hk', classes: ['G8 EC', '9T', '10G', '11J'] },
  { initial: 'CC', name: '鄭媛媛', email: 'dbscc@dbs.edu.hk', classes: ['9D', '10P'] },
  { initial: 'MYI', name: '葉銘欣', email: 'dbsmyi@dbs.edu.hk', classes: ['9S', '11D', '12S'] },
  { initial: 'SMC', name: '朱小萌', email: 'dbssmc@dbs.edu.hk', classes: ['9P', '10M', '11P'] },
  { initial: 'HKC', name: '陳曉君', email: 'dbshkc@dbs.edu.hk', classes: ['9G', '9L', '12G'] },
  { initial: 'KIC', name: '朱麒穎', email: 'dbskic@dbs.edu.hk', classes: ['9J', '10T', '11L'] },
]

export function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

export function parseClassMeta(name: string): { grade: string; kind: 'form' | 'ec' } {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) {
    const n = Number(ec[1])
    return { grade: gradeLabel(n), kind: 'ec' }
  }
  const form = name.match(/^(\d+)([A-Z])$/i)
  if (form) {
    return { grade: gradeLabel(Number(form[1])), kind: 'form' }
  }
  return { grade: '其他', kind: 'form' }
}

export function gradeLabel(grade: number): string {
  return `G${grade}`
}

export function gradeNumberFromClassName(name: string): number | null {
  const ec = name.match(/^G(\d+)\s*EC$/i)
  if (ec) return Number(ec[1])
  const form = name.match(/^(\d+)/)
  if (form) return Number(form[1])
  return null
}

export const GRADE_LEVELS = [7, 8, 9, 10, 11, 12] as const
