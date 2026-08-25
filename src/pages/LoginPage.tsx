import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import campus from '../assets/school-campus.png'
import crest from '../assets/dbs-crest.png'
import { defaultPath, useAuth } from '../context/AuthContext'
import { TextSizeControl } from '../components/TextSizeControl'

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
  const { user, ready, loginWithGoogle, authError, clearAuthError } = useAuth()
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

  const onGoogle = async () => {
    setGoogleBusy(true)
    const result = await loginWithGoogle()
    if (result) {
      fail(result)
      setGoogleBusy(false)
    }
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

        <div
          className={`login-card glass reveal-up delay-1${shaking ? ' shake' : ''}`}
        >
          <p className="login-card-title">登入</p>
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
          <p className="login-google-hint">請使用學校 Google 帳戶（@dbs.edu.hk）</p>
        </div>
      </div>
    </div>
  )
}
