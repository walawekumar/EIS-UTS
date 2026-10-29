import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthContext'
import { FinanceProvider } from '@/features/keuangan/finance-store'
import { PersediaanProvider } from '@/features/persediaan/persediaan-store'

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <PersediaanProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </PersediaanProvider>
      </FinanceProvider>
    </AuthProvider>
  )
}
