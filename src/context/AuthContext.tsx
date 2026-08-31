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
import type { Session } from '@supabase/supabase-js'
import {
  isAdminEmail,
  resolveStaffUser,
  roleForStaff,
  staffUsers,
} from '../data/staffUsers'
import { oauthRedirectTo, supabase } from '../lib/supabase'
import { persistGoogleTokensFromSession } from '../data/googleCalendarSync'
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
  ready: boolean
  authError: string | null
  /** How the user signed in — Google OAuth required for direct Calendar sync. */
  authMethod: 'google' | 'password' | null
  /** TWL / LKL / YLN school accounts may toggle 管理員 ↔ 老師 after sign-in. */
  canSwitchRole: boolean
  login: (username: string, password: string) => User | string
  loginWithGoogle: () => Promise<string | void>
  switchRole: (role: Role) => void
  logout: () => void
  clearAuthError: () => void
}

const globalKey = '__campusAuthContext'
const AuthContext: Context<AuthContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<AuthContextValue | null>
    | undefined) ?? createContext<AuthContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = AuthContext

const STORAGE_KEY = 'campus-cms-user'
const ROLE_KEY = 'campus-cms-role'
const METHOD_KEY = 'campus-cms-auth-method'

function isRole(value: string | null): value is Role {
  return value === 'admin' || value === 'teacher' || value === 'student'
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id: string }
    const stored = staffUsers.find((u) => u.id === parsed.id) ?? null
    if (!stored) return null
    if (stored.username.includes('@')) {
      return resolveStaffUser(
        stored.username,
        roleForStaff(stored.username, readStoredRole()),
      )
    }
    return stored
  } catch {
    return null
  }
}

function persistUser(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: user.id }))
}

function persistRole(role: Role) {
  localStorage.setItem(ROLE_KEY, role)
}

function readStoredRole(): Role | null {
  const raw = localStorage.getItem(ROLE_KEY)
  return isRole(raw) ? raw : null
}

function persistMethod(method: 'google' | 'password' | null) {
  if (!method) localStorage.removeItem(METHOD_KEY)
  else localStorage.setItem(METHOD_KEY, method)
}

function readMethod(): 'google' | 'password' | null {
  const raw = localStorage.getItem(METHOD_KEY)
  return raw === 'google' || raw === 'password' ? raw : null
}

function clearPersistedAuth() {
  localStorage.removeItem(STORAGE_KEY)
  persistMethod(null)
}

const GOOGLE_NOT_WHITELISTED = '此 Google 帳戶不在教師名單內。'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'google' | 'password' | null>(
    () => readMethod(),
  )

  const applySession = useCallback(async (session: Session | null) => {
    const email = session?.user?.email
    if (!email) {
      if (readMethod() === 'password') setUser(loadUser())
      else setUser(null)
      setAuthMethod(readMethod())
      return
    }

    const mapped = resolveStaffUser(
      email,
      roleForStaff(email, readStoredRole()),
    )
    if (!mapped) {
      setAuthError(GOOGLE_NOT_WHITELISTED)
      clearPersistedAuth()
      setUser(null)
      await supabase?.auth.signOut()
      return
    }

    setAuthError(null)
    persistUser(mapped)
    persistRole(mapped.role)
    persistMethod('google')
    setAuthMethod('google')
    persistGoogleTokensFromSession(mapped.id, session)
    setUser(mapped)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setUser(readMethod() === 'google' ? null : loadUser())
      setAuthMethod(readMethod())
      setReady(true)
      return
    }

    let cancelled = false

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        return applySession(data.session)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      void applySession(session)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [applySession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      authError,
      authMethod,
      canSwitchRole: Boolean(user && isAdminEmail(user.username)),
      login: (username, password) => {
        const found = staffUsers.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.password === password,
        )
        if (!found) return '帳戶或密碼不正確。'
        const resolved = found.username.includes('@')
          ? resolveStaffUser(
              found.username,
              roleForStaff(found.username, readStoredRole()),
            )
          : found
        if (!resolved) return '此帳戶無法登入。'
        persistUser(resolved)
        persistRole(resolved.role)
        persistMethod('password')
        setAuthMethod('password')
        setAuthError(null)
        setUser(resolved)
        return resolved
      },
      loginWithGoogle: async () => {
        if (!supabase) return '尚未連接 Google 登入（缺少 Supabase 設定）。'
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: oauthRedirectTo(),
            queryParams: {
              hd: 'dbs.edu.hk',
              prompt: 'select_account',
            },
          },
        })
        if (error) return error.message
      },
      switchRole: (role) => {
        if (!user || (role !== 'admin' && role !== 'teacher')) return
        if (!isAdminEmail(user.username)) return
        const mapped = resolveStaffUser(user.username, role)
        if (!mapped || mapped.role === user.role) return
        persistUser(mapped)
        persistRole(mapped.role)
        setUser(mapped)
      },
      logout: () => {
        setUser(null)
        setAuthMethod(null)
        clearPersistedAuth()
        localStorage.removeItem(ROLE_KEY)
        void supabase?.auth.signOut()
      },
      clearAuthError: () => setAuthError(null),
    }),
    [user, ready, authError, authMethod],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
