import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { users } from '../data/mockData'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string) => string | null
  logout: () => void
}

const globalKey = '__campusAuthContext'
const AuthContext: Context<AuthContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<AuthContextValue | null>
    | undefined) ?? createContext<AuthContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = AuthContext

const STORAGE_KEY = 'campus-cms-user'

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id: string }
    return users.find((u) => u.id === parsed.id) ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUser())

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (username, password) => {
        const found = users.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.password === password,
        )
        if (!found) return '帳戶或密碼不正確。'
        setUser(found)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: found.id }))
        return null
      },
      logout: () => {
        setUser(null)
        localStorage.removeItem(STORAGE_KEY)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
