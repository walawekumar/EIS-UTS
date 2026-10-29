import { Outlet } from 'react-router-dom'
import { PembelianProvider } from '@/features/pembelian/PembelianContext'

/** Induk modul Pembelian: data bersama untuk sub-halaman pencatatan, penerimaan, pembayaran. */
export function PembelianPage() {
  return (
    <PembelianProvider>
      <Outlet />
    </PembelianProvider>
  )
}
