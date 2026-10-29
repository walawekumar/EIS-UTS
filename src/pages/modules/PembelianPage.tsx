import { Outlet } from 'react-router-dom'
import { PembelianSubnav } from '@/components/pembelian/PembelianSubnav'
import { PembelianProvider } from '@/features/pembelian/PembelianContext'

/** Induk modul Pembelian: data bersama + stepper alur. */
export function PembelianPage() {
  return (
    <PembelianProvider>
      <div className="space-y-2.5">
        <PembelianSubnav />
        <Outlet />
      </div>
    </PembelianProvider>
  )
}
