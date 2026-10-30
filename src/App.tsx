import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { AuditProvider } from '@/features/audit/audit-store'
import { AuthProvider } from '@/features/auth/AuthContext'
import { FinanceProvider } from '@/features/keuangan/finance-store'
import { MasterProvider } from '@/features/master/master-store'
import { PembelianProvider } from '@/features/pembelian/PembelianContext'
import { PenjualanProvider } from '@/features/penjualan/PenjualanContext'
import { PersediaanProvider } from '@/features/persediaan/persediaan-store'
import { PayrollProvider } from '@/features/payroll/payroll-store'
import { ProduksiProvider } from '@/features/produksi/ProduksiContext'
import { initTheme } from '@/features/settings/theme'

export default function App() {
  useEffect(() => initTheme(), [])

  return (
    <AuthProvider>
      <AuditProvider>
        <MasterProvider>
          <FinanceProvider>
            <PayrollProvider>
              <PersediaanProvider>
                <ProduksiProvider>
                  <PembelianProvider>
                    <PenjualanProvider>
                      <BrowserRouter>
                        <AppRouter />
                      </BrowserRouter>
                    </PenjualanProvider>
                  </PembelianProvider>
                </ProduksiProvider>
              </PersediaanProvider>
            </PayrollProvider>
          </FinanceProvider>
        </MasterProvider>
      </AuditProvider>
    </AuthProvider>
  )
}
