import { Outlet } from 'react-router-dom'
import { AbsensiProvider } from '@/features/absensi/absensi-store'
import { AuditProvider } from '@/features/audit/audit-store'
import { OpsCloudGate } from '@/features/cloud/OpsCloudGate'
import { FinanceProvider } from '@/features/keuangan/finance-store'
import { BankProvider } from '@/features/keuangan/bank-store'
import { PeriodProvider } from '@/features/keuangan/period-store'
import { ExpenseTaxBridge, TaxProvider } from '@/features/keuangan/tax-store'
import { MasterProvider } from '@/features/master/master-store'
import { PembelianProvider } from '@/features/pembelian/PembelianContext'
import { PenjualanProvider } from '@/features/penjualan/PenjualanContext'
import { PersediaanProvider } from '@/features/persediaan/persediaan-store'
import { PayrollProvider } from '@/features/payroll/payroll-store'
import { ProduksiProvider } from '@/features/produksi/ProduksiContext'

/** Cloud hydrate + domain stores — only after login so login UX stays clean. */
export function AuthenticatedProviders() {
  return (
    <OpsCloudGate>
      <AuditProvider>
        <MasterProvider>
          <FinanceProvider>
            <PeriodProvider>
              <BankProvider>
                <TaxProvider>
                  <ExpenseTaxBridge />
                  <PayrollProvider>
                    <AbsensiProvider>
                      <PersediaanProvider>
                        <ProduksiProvider>
                          <PembelianProvider>
                            <PenjualanProvider>
                              <Outlet />
                            </PenjualanProvider>
                          </PembelianProvider>
                        </ProduksiProvider>
                      </PersediaanProvider>
                    </AbsensiProvider>
                  </PayrollProvider>
                </TaxProvider>
              </BankProvider>
            </PeriodProvider>
          </FinanceProvider>
        </MasterProvider>
      </AuditProvider>
    </OpsCloudGate>
  )
}
