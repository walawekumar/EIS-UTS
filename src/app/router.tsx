import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/RequireAuth'
import { ModuleShell } from '@/components/layout/ModuleShell'
import { LoginPage } from '@/pages/LoginPage'
import { PortalPage } from '@/pages/PortalPage'
import { DashboardPage } from '@/pages/modules/DashboardPage'
import { KeuanganPage } from '@/pages/modules/KeuanganPage'
import { MasterDataPage } from '@/pages/modules/MasterDataPage'
import { PembelianPage } from '@/pages/modules/PembelianPage'
import { PenjualanPage } from '@/pages/modules/PenjualanPage'
import { PersediaanPage } from '@/pages/modules/PersediaanPage'
import { ProduksiPage } from '@/pages/modules/ProduksiPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/portal" element={<PortalPage />} />

        <Route
          path="/app/dashboard"
          element={
            <ModuleShell
              title="Dashboard"
              subtitle="Ringkasan operasional dan keuangan usaha"
            />
          }
        >
          <Route index element={<DashboardPage />} />
        </Route>

        <Route
          path="/app/master-data"
          element={
            <ModuleShell
              title="Master Data"
              subtitle="Data acuan pemasok, pelanggan, produk, dan pengguna"
            />
          }
        >
          <Route index element={<MasterDataPage />} />
        </Route>

        <Route
          path="/app/pembelian"
          element={
            <ModuleShell
              title="Pembelian"
              subtitle="Pembelian dan penerimaan gabah dari pemasok"
            />
          }
        >
          <Route index element={<PembelianPage />} />
        </Route>

        <Route
          path="/app/persediaan"
          element={
            <ModuleShell
              title="Persediaan"
              subtitle="Saldo dan mutasi bahan baku serta produk"
            />
          }
        >
          <Route index element={<PersediaanPage />} />
        </Route>

        <Route
          path="/app/produksi"
          element={
            <ModuleShell
              title="Produksi"
              subtitle="Batch giling multi-output dan perhitungan rendemen"
            />
          }
        >
          <Route index element={<ProduksiPage />} />
        </Route>

        <Route
          path="/app/penjualan"
          element={
            <ModuleShell
              title="Penjualan"
              subtitle="Penjualan, pengiriman, dan tagihan pelanggan"
            />
          }
        >
          <Route index element={<PenjualanPage />} />
        </Route>

        <Route
          path="/app/keuangan"
          element={
            <ModuleShell
              title="Keuangan"
              subtitle="Kas, utang, piutang, dan biaya operasional dasar"
            />
          }
        >
          <Route index element={<KeuanganPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/portal" replace />} />
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  )
}
