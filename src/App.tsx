import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthContext'
import { initTheme } from '@/features/settings/theme'

export default function App() {
  useEffect(() => initTheme(), [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  )
}
