import type { ReactNode } from 'react'
import { GlassPanel } from './GlassPanel'

export type AsyncStatusVariant = 'loading' | 'empty' | 'error' | 'offline'

const DEFAULT_MESSAGES: Record<AsyncStatusVariant, string> = {
  loading: '載入中…',
  empty: '暫無資料。',
  error: '載入失敗，請稍後再試。',
  offline: '尚未連線資料庫。',
}

type AsyncStatusProps = {
  variant: AsyncStatusVariant
  message?: string
  /** Wrap in GlassPanel (default true). Set false when nesting inside an existing panel. */
  panel?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Shared loading / empty / error / offline surface for staff data pages.
 */
export function AsyncStatus({
  variant,
  message,
  panel = true,
  className = '',
  children,
}: AsyncStatusProps) {
  const text = message ?? DEFAULT_MESSAGES[variant]
  const role = variant === 'loading' ? 'status' : variant === 'empty' ? 'status' : 'alert'
  const body = (
    <>
      <p
        className={`async-status async-status-${variant}${className ? ` ${className}` : ''}`}
        role={role}
      >
        {text}
      </p>
      {children}
    </>
  )
  if (!panel) return body
  return <GlassPanel className="reveal-up delay-1">{body}</GlassPanel>
}
