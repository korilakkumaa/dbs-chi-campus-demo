import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import campus from '../assets/school-campus.png'
import crest from '../assets/dbs-crest.png'
import { defaultPath, ROLE_LABEL, useAuth } from '../context/AuthContext'
import { TextSizeControl } from '../components/TextSizeControl'
import type { Role } from '../types'

const LOGIN_ROLES: {
  role: Role
  features: string[]
  hint: string
}[] = [
  {
    role: 'admin',
    features: ['全校班級', '首頁、日曆、時間表、分數、其他資料', '分派教師與截止日期'],
    hint: 'TWL、LKL 或 YLN 的學校 Google 帳戶',
  },
  {
    role: 'teacher',
    features: ['所任教班級', '首頁、日曆、時間表、分數、其他資料'],
    hint: '教師學校 Google 帳戶（@dbs.edu.hk）',
  },
]

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46c-.28 1.36-1.12 2.51-2.38 3.28v2.72h3.85c2.25-2.07 3.56-5.12 3.56-8.24z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.85-2.72c-1.07.72-2.45 1.15-4.1 1.15-3.15 0-5.82-2.13-6.77-4.99H1.26v2.8C3.24 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.23 14.53A7.23 7.23 0 0 1 4.85 12c0-.88.16-1.73.38-2.53V6.67H1.26A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.26 5.33l3.97-2.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.95 1.14 15.24 0 12 0 7.31 0 3.24 2.7 1.26 6.67l3.97 2.8C6.18 6.88 8.85 4.75 12 4.75z"
      />
    </svg>
  )
}

export function AuthBootScreen() {
  return (
    <div className="login-page" aria-busy="true" aria-label="載入中">
      <img className="login-bg" src={campus} alt="" aria-hidden />
      <div className="login-veil" aria-hidden />
    </div>
  )
}

export function LoginPage() {
  const { user, ready, login, loginWithGoogle, authError, clearAuthError } =
    useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  const fail = (message: string) => {
    setError(message)
    setShaking(true)
    window.setTimeout(() => setShaking(false), 420)
  }

  useEffect(() => {
    if (!authError) return
    fail(authError)
    clearAuthError()
  }, [authError, clearAuthError])

  if (ready && user) return <Navigate to={defaultPath(user.role)} replace />

  const selected = LOGIN_ROLES.find((item) => item.role === mode) ?? null

  const pickMode = (role: Role) => {
    setMode(role)
    setError(null)
  }

  const onGoogle = async () => {
    if (!mode) {
      fail('請先選擇登入身分。')
      return
    }
    setGoogleBusy(true)
    const result = await loginWithGoogle(mode)
    if (result) {
      fail(result)
      setGoogleBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!mode) {
      fail('請先選擇登入身分。')
      return
    }
    const result = login(username, password, mode)
    if (typeof result === 'string') {
      fail(result)
      return
    }
    navigate(defaultPath(result.role))
  }

  return (
    <div className="login-page">
      <img className="login-bg" src={campus} alt="" aria-hidden />
      <div className="login-veil" aria-hidden />
      <div className="login-text-size">
        <TextSizeControl />
      </div>

      <div className="login-compose">
        <header className="login-brand reveal-up">
          <div className="login-brand-lockup">
            <img className="login-crest" src={crest} alt="" aria-hidden />
            <p className="login-brand-name">拔萃男書院</p>
          </div>
          <h1 className="login-headline">好書是最好的朋友，今天是，永遠都是。</h1>
        </header>

        <form
          className={`login-card glass reveal-up delay-1${shaking ? ' shake' : ''}`}
          onSubmit={onSubmit}
        >
          <p className="login-card-title">登入</p>
          <p className="login-mode-label">選擇身份</p>
          <div className="login-modes" role="group" aria-label="登入身份">
            {LOGIN_ROLES.map((item) => (
              <button
                key={item.role}
                type="button"
                className={`login-mode${mode === item.role ? ' active' : ''}`}
                aria-pressed={mode === item.role}
                onClick={() => pickMode(item.role)}
              >
                {ROLE_LABEL[item.role]}
              </button>
            ))}
          </div>
          {selected && (
            <p className="login-role-note">
              {ROLE_LABEL[selected.role]}可使用：{selected.features.join('、')}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          <button
            type="button"
            className="google-btn"
            onClick={() => void onGoogle()}
            disabled={googleBusy}
          >
            <GoogleMark />
            {googleBusy ? '正在前往 Google…' : '以 Google 登入'}
          </button>
          <details className="login-password">
            <summary>或以帳戶密碼登入</summary>
            <label>
              <span>帳戶</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  selected ? selected.hint : '請先選擇管理員或教師'
                }
              />
            </label>
            <label>
              <span>密碼</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
              />
            </label>
            <button type="submit" className="primary-btn">
              進入校園
            </button>
          </details>
        </form>
      </div>
    </div>
  )
}
