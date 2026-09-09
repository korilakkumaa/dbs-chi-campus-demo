import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TextSizeProvider } from './context/TextSizeContext'
import { applyTextSize, readTextSize } from './lib/textSize'
import { appRouter } from './App'
import './index.css'

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
