/** Shared CSV helpers for admin year-setup imports. */

export type CsvParseResult = {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const escape = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\n') + '\n'
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase())
    if (found && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim()
    }
  }
  return ''
}

export function truthyFlag(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  return s === '1' || s === 'y' || s === 'yes' || s === 'true' || s === '是'
}
