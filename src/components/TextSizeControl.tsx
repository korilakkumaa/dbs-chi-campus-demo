import { TEXT_SIZE_LABEL, type TextSize } from '../lib/textSize'
import { useTextSize } from '../context/TextSizeContext'

const OPTIONS: TextSize[] = ['small', 'normal', 'large']

export function TextSizeControl({ className = '' }: { className?: string }) {
  const { textSize, setTextSize } = useTextSize()

  return (
    <div
      className={`text-size-control${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="字體大小"
    >
      {OPTIONS.map((size) => (
        <button
          key={size}
          type="button"
          className={`text-size-btn${textSize === size ? ' selected' : ''}`}
          aria-pressed={textSize === size}
          title={`字體：${TEXT_SIZE_LABEL[size]}`}
          onClick={() => setTextSize(size)}
        >
          {TEXT_SIZE_LABEL[size]}
        </button>
      ))}
    </div>
  )
}
