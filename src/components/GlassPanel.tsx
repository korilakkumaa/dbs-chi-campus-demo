import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'aside' | 'header' | 'form'
}

export function GlassPanel({
  children,
  className = '',
  as: Tag = 'div',
}: GlassPanelProps) {
  return <Tag className={`panel ${className}`.trim()}>{children}</Tag>
}
