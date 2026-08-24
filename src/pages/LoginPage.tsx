import { useState, type FormEvent } from 'react'
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
    hint: '管理員帳戶',
  },
  {
    role: 'teacher',
    features: ['所任教班級', '首頁、日曆、時間表、分數、其他資料'],
    hint: '教師電郵（學校電郵）',
  },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)

  if (user) return <Navigate to={defaultPath(user.role)} replace />

  const selected = LOGIN_ROLES.find((item) => item.role === mode) ?? null

  const pickMode = (role: Role) => {
    setMode(role)
    setError(null)
  }

  const fail = (message: string) => {
    setError(message)
    setShaking(true)
    window.setTimeout(() => setShaking(false), 420)
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
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="primary-btn">
            進入校園
          </button>
        </form>
      </div>
    </div>
  )
}
