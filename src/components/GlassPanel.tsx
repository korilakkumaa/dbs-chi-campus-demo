import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'aside' | 'header' | 'form'
  id?: string
}

export function GlassPanel({
  children,
  className = '',
  as: Tag = 'div',
  id,
}: GlassPanelProps) {
  return (
    <Tag id={id} className={`panel ${className}`.trim()}>
      {children}
    </Tag>
  )
}
