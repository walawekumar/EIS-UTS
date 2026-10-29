import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  )
}
