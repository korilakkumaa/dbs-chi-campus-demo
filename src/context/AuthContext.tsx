import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { staffUsers } from '../data/staffUsers'
import type { Role, User } from '../types'

export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理員',
  teacher: '教師',
  student: '學生',
}

export function defaultPath(role?: Role) {
  return role === 'student' ? '/tower' : '/progress'
}

interface AuthContextValue {
  user: User | null
  login: (username: string, password: string, role: Role) => User | string
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
    return staffUsers.find((u) => u.id === parsed.id) ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUser())

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (username, password, role) => {
        const found = staffUsers.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.password === password,
        )
        if (!found) return '帳戶或密碼不正確。'
        if (found.role !== role) {
          return `此帳戶不是${ROLE_LABEL[role]}身分。`
        }
        setUser(found)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: found.id }))
        return found
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
