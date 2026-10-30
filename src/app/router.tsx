import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/RequireAuth'
import { RequireRole } from '@/app/RequireRole'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DashboardPage } from '@/pages/modules/DashboardPage'
import { AuditPage } from '@/pages/modules/AuditPage'
import { BiayaPage } from '@/pages/modules/keuangan/BiayaPage'
import { KasPage } from '@/pages/modules/keuangan/KasPage'
import { PayrollPage } from '@/pages/modules/keuangan/PayrollPage'
import { PiutangPage } from '@/pages/modules/keuangan/PiutangPage'
import { UtangPage } from '@/pages/modules/keuangan/UtangPage'
import { LaporanPage } from '@/pages/modules/LaporanPage'
import { KoreksiPage } from '@/pages/modules/persediaan/KoreksiPage'
import { MutasiPage } from '@/pages/modules/persediaan/MutasiPage'
import { SaldoPage } from '@/pages/modules/persediaan/SaldoPage'
import { MitraPage } from '@/pages/modules/master/MitraPage'
import { PenggunaPage } from '@/pages/modules/master/PenggunaPage'
import { ProdukPage } from '@/pages/modules/master/ProdukPage'
import { PembelianPage } from '@/pages/modules/PembelianPage'
import { PembayaranPage } from '@/pages/modules/pembelian/PembayaranPage'
import { PencatatanPage } from '@/pages/modules/pembelian/PencatatanPage'
import { PenerimaanPage } from '@/pages/modules/pembelian/PenerimaanPage'
import { PenjualanPage } from '@/pages/modules/PenjualanPage'
import { OrderPage } from '@/pages/modules/penjualan/OrderPage'
import { PengirimanPage } from '@/pages/modules/penjualan/PengirimanPage'
import { TagihanPage } from '@/pages/modules/penjualan/TagihanPage'
import { ProduksiPage } from '@/pages/modules/ProduksiPage'
import { BatchPage } from '@/pages/modules/produksi/BatchPage'
import { InputOutputPage } from '@/pages/modules/produksi/InputOutputPage'
import { RendemenPage } from '@/pages/modules/produksi/RendemenPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/portal" element={<Navigate to="/app/dashboard" replace />} />

        <Route element={<RequireRole />}>
          <Route
            path="/app/dashboard"
            element={
              <AppShell title="Dashboard" subtitle="Ringkasan sesuai peran Anda" />
            }
          >
            <Route index element={<DashboardPage />} />
          </Route>

          <Route
            path="/app/settings"
            element={
              <AppShell
                title="Pengaturan"
                subtitle="Profil, perusahaan, preferensi, notifikasi, dan keamanan"
              />
            }
          >
            <Route index element={<SettingsPage />} />
          </Route>

          <Route
            path="/app/master-data"
            element={
              <AppShell
                title="Master Data"
                subtitle="Data acuan pemasok, pelanggan, produk, dan pengguna"
              />
            }
          >
            <Route index element={<MitraPage />} />
            <Route path="produk" element={<ProdukPage />} />
            <Route path="pengguna" element={<PenggunaPage />} />
          </Route>

          <Route
            path="/app/pembelian"
            element={
              <AppShell
                title="Pembelian Gabah"
                subtitle="Pencatatan, penerimaan & timbang, dan pembayaran pemasok"
              />
            }
          >
            <Route element={<PembelianPage />}>
              <Route index element={<PencatatanPage />} />
              <Route
                path="pencatatan"
                element={<Navigate to="/app/pembelian" replace />}
              />
              <Route path="penerimaan" element={<PenerimaanPage />} />
              <Route path="pembayaran" element={<PembayaranPage />} />
              <Route
                path="utang"
                element={<Navigate to="/app/pembelian/pembayaran" replace />}
              />
            </Route>
          </Route>

          <Route
            path="/app/persediaan"
            element={
              <AppShell
                title="Persediaan"
                subtitle="Saldo, mutasi, transfer lokasi, dan koreksi stok"
              />
            }
          >
            <Route index element={<SaldoPage />} />
            <Route path="mutasi" element={<MutasiPage />} />
            <Route path="koreksi" element={<KoreksiPage />} />
          </Route>

          <Route
            path="/app/produksi"
            element={
              <AppShell
                title="Produksi"
                subtitle="Batch giling multi-output, approve, dan rendemen"
              />
            }
          >
            <Route element={<ProduksiPage />}>
              <Route index element={<BatchPage />} />
              <Route path="input-output" element={<InputOutputPage />} />
              <Route path="rendemen" element={<RendemenPage />} />
            </Route>
          </Route>

          <Route
            path="/app/penjualan"
            element={
              <AppShell
                title="Penjualan"
                subtitle="Order, pengiriman, dan tagihan pelanggan"
              />
            }
          >
            <Route element={<PenjualanPage />}>
              <Route index element={<OrderPage />} />
              <Route path="pengiriman" element={<PengirimanPage />} />
              <Route path="tagihan" element={<TagihanPage />} />
            </Route>
          </Route>

          <Route
            path="/app/keuangan"
            element={
              <AppShell
                title="Keuangan"
                subtitle="Kas, utang, piutang, dan biaya operasional dasar"
              />
            }
          >
            <Route index element={<KasPage />} />
            <Route
              path="kas"
              element={<Navigate to="/app/keuangan" replace />}
            />
            <Route path="utang" element={<UtangPage />} />
            <Route path="piutang" element={<PiutangPage />} />
            <Route path="biaya" element={<BiayaPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route
              path="utang-piutang"
              element={<Navigate to="/app/keuangan/utang" replace />}
            />
          </Route>

          <Route
            path="/app/laporan"
            element={
              <AppShell
                title="Laporan"
                subtitle="Ringkasan operasional, aging, stok, dan rendemen"
              />
            }
          >
            <Route index element={<LaporanPage />} />
          </Route>

          <Route
            path="/app/audit"
            element={
              <AppShell
                title="Audit Log"
                subtitle="Jejak perubahan domain sebelum backend"
              />
            }
          >
            <Route index element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
