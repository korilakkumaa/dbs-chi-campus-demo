import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TextSizeProvider } from './context/TextSizeContext'
import { applyTextSize, readTextSize } from './lib/textSize'
import App from './App'
import './index.css'

applyTextSize(readTextSize())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <TextSizeProvider>
          <App />
        </TextSizeProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
