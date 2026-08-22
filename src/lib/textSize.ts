export type TextSize = 'small' | 'normal' | 'large'

export const TEXT_SIZE_STORAGE_KEY = 'campus-text-size'

const VALID: TextSize[] = ['small', 'normal', 'large']

export function readTextSize(): TextSize {
  try {
    const raw = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    if (raw && VALID.includes(raw as TextSize)) return raw as TextSize
  } catch {
    /* ignore */
  }
  return 'normal'
}

export function applyTextSize(size: TextSize) {
  document.documentElement.dataset.textSize = size
}

export const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  small: '小',
  normal: '中',
  large: '大',
}
