/** Parse raw assessment-duty strings into compact structured rows. */

export type DutySemester = 'first' | 'second' | 'both' | 'mock' | 'year'

export type DutyPart = '甲' | '乙' | '甲乙'

export type DutySlot = {
  semester: DutySemester
  part: DutyPart | null
  note: string | null
  teacherCode: string
  weight: number | null
}

export type TeacherDutyItem = {
  ec: boolean
  grade: string
  task: string
  weight: number | null
}

export type EcAppendixRow = {
  grade: string
  firstPaper1: string | null
  firstPaper2: string | null
  secondPaper1: string | null
  secondPaper2: string | null
}

const TEACHER_RE = /(.+?)\s*\[(\w+)\]\s*(?:\(([\d.]+)\))?/g

const NOTE_SHORT: Record<string, string> = {
  聆聽評估: '聆聽',
  SBA文字報告: 'SBA文',
  SBA口頭匯報: 'SBA口',
  'Pre-mock及小測試卷擬題': 'Post-Mock',
  'Pre-mock -G9 TSA': 'TSA',
  中一新生入學分班試: '分班試',
  初中擬題: '初中擬',
  初中批改: '初中改',
  高中擬題: '高中擬',
  高中批改: '高中改',
}

export function shortenNote(note: string): string {
  return NOTE_SHORT[note] ?? note.replace(/試卷擬題$/, '').replace(/評估$/, '')
}

export function shortenTask(raw: string): string {
  return raw
    .replace(/閱讀能力\(甲部文言\)/, '卷一·甲')
    .replace(/閱讀能力\(乙部白話\)/, '卷一·乙')
    .replace(/寫作能力\(甲部實用文\)/, '卷二·甲')
    .replace(/寫作能力\(甲部實用短文\)/, '卷二·甲')
    .replace(/寫作能力\(乙部命題\)/, '卷二·乙')
    .replace(/寫作能力\(乙部\)/, '卷二·乙')
    .replace(/閱讀能力評估/, '卷一')
    .replace(/寫作能力評估/, '卷二')
    .replace(/階段性統測/, '統測')
    .replace(/校本評核\(SBA\)文字報告/, 'SBA文')
    .replace(/校本評核\(SBA\)口頭匯報/, 'SBA口')
    .replace(/畢業試\(Post-Mock\)及小測/, 'Post-Mock')
    .replace(/Pre-mock TSA/, 'TSA')
    .replace(/新生入學分班試/, '分班試')
    .replace(/學年補考閱卷/, '補考閱')
    .replace(/學年補考/, '補考')
    .replace(/聆聽評估/, '聆聽')
    .trim()
}

export function gradeShortLabel(gradeLabel: string): string {
  const m = gradeLabel.match(/^(中[一二三四五六])/)
  if (m) return m[1]
  if (gradeLabel.includes('補考')) return '補考'
  return gradeLabel
}

export function semesterLabel(semester: DutySemester): string {
  switch (semester) {
    case 'first':
      return '上'
    case 'second':
      return '下'
    case 'both':
      return '全年'
    case 'mock':
      return 'Mock'
    default:
      return '—'
  }
}

function parsePartPrefix(line: string): { part: DutyPart | null; rest: string } {
  if (line.startsWith('甲/乙部：') || line.startsWith('甲/乙部:'))
    return { part: '甲乙', rest: line.replace(/^甲\/乙部[：:]\s*/, '') }
  if (line.startsWith('甲：') || line.startsWith('甲:'))
    return { part: '甲', rest: line.replace(/^甲[：:]\s*/, '') }
  if (line.startsWith('乙：') || line.startsWith('乙:'))
    return { part: '乙', rest: line.replace(/^乙[：:]\s*/, '') }
  return { part: null, rest: line }
}

function extractTeachers(
  text: string,
  semester: DutySemester,
  part: DutyPart | null,
  note: string | null,
): DutySlot[] {
  const slots: DutySlot[] = []
  let match: RegExpExecArray | null
  TEACHER_RE.lastIndex = 0
  while ((match = TEACHER_RE.exec(text)) !== null) {
    slots.push({
      semester,
      part,
      note: note ? shortenNote(note) : null,
      teacherCode: match[2],
      weight: match[3] != null ? Number(match[3]) : null,
    })
  }
  return slots
}

export function parseGradeCell(raw: string | null | undefined): DutySlot[] {
  if (!raw) return []

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const slots: DutySlot[] = []
  let semester: DutySemester = 'year'
  let note: string | null = null

  for (const line of lines) {
    if (/^\(上\)、\(下\)/.test(line)) {
      semester = 'both'
      const rest = line.replace(/^\(上\)、\(下\)\s*/, '')
      slots.push(...extractTeachers(rest, semester, null, note))
      note = null
      continue
    }

    const semMatch = line.match(/^\((上|下|Mock)\)\s*(.*)$/)
    if (semMatch) {
      semester =
        semMatch[1] === '上' ? 'first' : semMatch[1] === '下' ? 'second' : 'mock'
      const rest = semMatch[2]
      if (!rest) continue
      if (rest.endsWith('：') && !/\[/.test(rest)) {
        note = rest.replace(/：$/, '')
        continue
      }
      const parsed = parsePartPrefix(rest)
      slots.push(...extractTeachers(parsed.rest, semester, parsed.part, note))
      note = null
      continue
    }

    if (line.endsWith('：') && !/\[/.test(line)) {
      note = line.replace(/：$/, '')
      continue
    }

    const roleSplit = line.match(/^(.+?[擬批]題|.+?[擬批]改)[：:]\s*(.+)$/)
    if (roleSplit) {
      note = roleSplit[1]
      slots.push(...extractTeachers(roleSplit[2], semester, null, note))
      note = null
      continue
    }

    const parsed = parsePartPrefix(line)
    const found = extractTeachers(parsed.rest, semester, parsed.part, note)
    if (found.length) {
      slots.push(...found)
      note = null
    }
  }

  return slots
}

export function parseTeacherBullets(raw: string | null | undefined): TeacherDutyItem[] {
  if (!raw) return []

  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('•'))
    .map((line) => {
      let body = line.replace(/^•\s*/, '')
      const ec = body.startsWith('EC')
      if (ec) body = body.slice(2)

      let weight: number | null = null
      const wm = body.match(/\(([\d.]+)\)\s*$/)
      if (wm) {
        weight = Number(wm[1])
        body = body.slice(0, wm.index).trim()
      }

      const gm = body.match(/^(中[一二三四五六](?:至中[一二三四六])?|初中|高中)\s+(.+)$/)
      if (gm) {
        return {
          ec,
          grade: gm[1],
          task: shortenTask(gm[2]),
          weight,
        }
      }

      return {
        ec,
        grade: '—',
        task: shortenTask(body),
        weight,
      }
    })
}

function extractCode(text: string): string | null {
  const m = text.match(/\[(\w+)\]/)
  return m?.[1] ?? null
}

export function parseEcAppendix(notes: string[]): EcAppendixRow[] {
  return notes.map((note) => {
    const gradeMatch = note.match(/中([一二三四六])級/)
    const grade = gradeMatch ? `中${gradeMatch[1]}` : '—'

    const firstBlock = note.match(/\(第一學期\)\s*([^；]+)/)
    const secondBlock = note.match(/\(第二學期\)\s*([^；]+)/)

    const parseBlock = (block: string | undefined) => {
      if (!block) return { paper1: null, paper2: null }
      const sameBoth =
        block.includes('卷一閱讀、卷二寫作') && !block.includes('卷一閱讀由')
      if (sameBoth) {
        const code = extractCode(block)
        return { paper1: code, paper2: code }
      }
      const p1 = block.match(/卷一閱讀由\s*.+?\[(\w+)\]/)
      const p2 = block.match(/卷二寫作由\s*.+?\[(\w+)\]/)
      return { paper1: p1?.[1] ?? null, paper2: p2?.[1] ?? null }
    }

    const first = parseBlock(firstBlock?.[1])
    const second = parseBlock(secondBlock?.[1])

    return {
      grade,
      firstPaper1: first.paper1,
      firstPaper2: first.paper2,
      secondPaper1: second.paper1,
      secondPaper2: second.paper2,
    }
  })
}
