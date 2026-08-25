import { officialStudentNo } from './campusScoresYear'

/**
 * School Google mailbox from official student number.
 * e.g. 2024072090 → dbs24072090@g.dbs.edu.hk
 */
export function studentEmailFromOfficialNo(officialNo: string): string | null {
  const digits = String(officialNo).trim().replace(/\D/g, '')
  if (digits.length < 8) return null
  const local = digits.startsWith('20') ? digits.slice(2) : digits
  if (!local) return null
  return `dbs${local}@g.dbs.edu.hk`
}

/** Accept stored PK (`2024072090` or `y2024-2024072090`). */
export function studentEmailFromStoredNo(storedStudentNo: string): string | null {
  return studentEmailFromOfficialNo(officialStudentNo(storedStudentNo))
}

export function isAbsMarker(raw: string): boolean {
  return raw.trim().toLowerCase() === 'abs'
}
