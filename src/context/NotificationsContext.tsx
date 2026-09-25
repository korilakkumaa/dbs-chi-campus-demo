import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import {
  fetchNotificationsForRecipient,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationsForRecipient,
  type SystemNotification,
} from '../data/systemNotifications'
import { useAuth } from './AuthContext'

export interface NotificationsContextValue {
  notifications: SystemNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => void
}

const globalKey = '__campusNotificationsContext'
const NotificationsContext: Context<NotificationsContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<NotificationsContextValue | null>
    | undefined) ?? createContext<NotificationsContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = NotificationsContext

function mergeNotification(
  list: SystemNotification[],
  row: SystemNotification,
): SystemNotification[] {
  const without = list.filter((n) => n.id !== row.id)
  return [row, ...without].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<SystemNotification[]>([])

  const refresh = useCallback(() => {
    const recipientId = user?.id
    if (!recipientId || user.role === 'student') {
      setNotifications([])
      return
    }
    void fetchNotificationsForRecipient(recipientId).then(setNotifications)
  }, [user?.id, user?.role])

  useEffect(() => {
    refresh()
    if (!user?.id || user.role === 'student') return
    return subscribeNotificationsForRecipient(user.id, (row) => {
      setNotifications((prev) => mergeNotification(prev, row))
    })
  }, [user?.id, user?.role, refresh])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.readAt).length,
      markRead: (id) => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id && !n.readAt
              ? { ...n, readAt: new Date().toISOString() }
              : n,
          ),
        )
        void markNotificationRead(id)
      },
      markAllRead: () => {
        if (!user?.id) return
        const now = new Date().toISOString()
        setNotifications((prev) =>
          prev.map((n) => (n.readAt ? n : { ...n, readAt: now })),
        )
        void markAllNotificationsRead(user.id)
      },
      refresh,
    }),
    [notifications, user?.id, refresh],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    )
  }
  return ctx
}
