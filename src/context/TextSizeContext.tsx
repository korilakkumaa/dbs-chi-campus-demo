import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyTextSize,
  readTextSize,
  TEXT_SIZE_STORAGE_KEY,
  type TextSize,
} from '../lib/textSize'

interface TextSizeContextValue {
  textSize: TextSize
  setTextSize: (size: TextSize) => void
}

const TextSizeContext = createContext<TextSizeContextValue | null>(null)

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(() => readTextSize())

  useEffect(() => {
    applyTextSize(textSize)
    try {
      localStorage.setItem(TEXT_SIZE_STORAGE_KEY, textSize)
    } catch {
      /* ignore */
    }
  }, [textSize])

  const value = useMemo(
    () => ({
      textSize,
      setTextSize: setTextSizeState,
    }),
    [textSize],
  )

  return (
    <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>
  )
}

export function useTextSize() {
  const ctx = useContext(TextSizeContext)
  if (!ctx) throw new Error('useTextSize must be used within TextSizeProvider')
  return ctx
}
