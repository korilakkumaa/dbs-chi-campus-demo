import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import campus from '../assets/school-campus.png'
import crest from '../assets/dbs-crest.png'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)

  if (user) return <Navigate to="/progress" replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const err = login(username, password)
    if (err) {
      setError(err)
      setShaking(true)
      window.setTimeout(() => setShaking(false), 420)
      return
    }
    navigate('/progress')
  }

  return (
    <div className="login-page">
      <img className="login-bg" src={campus} alt="" aria-hidden />
      <div className="login-veil" aria-hidden />

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
          <label>
            <span>帳戶</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="教師或管理員"
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
          <p className="login-hint">
            示範：管理員 <code>admin</code>；四班教師 <code>teacher</code>
            （吳綺琳／YLN）／密碼 <code>campus</code>
          </p>
        </form>
      </div>
    </div>
  )
}
