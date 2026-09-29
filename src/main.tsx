import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TextSizeProvider } from './context/TextSizeContext'
import { applyTextSize, readTextSize } from './lib/textSize'
import { appRouter } from './App'
import './index.css'

const preloadReloadKey = 'campus-preload-reload'

window.addEventListener('vite:preloadError', (event) => {
  const now = Date.now()
  let previous = 0
  try {
    previous = Number(sessionStorage.getItem(preloadReloadKey) || 0)
  } catch {
    previous = 0
  }
  // A deploy removes the previous hashed chunks. GitHub then serves 404.html
  // for that URL, and the browser refuses to execute it as a module. Reload
  // once so the open tab picks up index.html that matches the new files.
  if (now - previous < 15_000) return
  try {
    sessionStorage.setItem(preloadReloadKey, String(now))
  } catch {
    /* private mode */
  }
  event.preventDefault()
  window.location.reload()
})

applyTextSize(readTextSize())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TextSizeProvider>
        <RouterProvider router={appRouter} />
      </TextSizeProvider>
    </AuthProvider>
  </StrictMode>,
)
