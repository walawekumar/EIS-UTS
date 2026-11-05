import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthenticatedProviders } from '@/app/AuthenticatedProviders'
import { RequireAnyRole } from '@/app/RequireAnyRole'
import { RequireAuth } from '@/app/RequireAuth'
import { RequireRole } from '@/app/RequireRole'
import { AppShell } from '@/components/layout/AppShell'
import { ModuleShell } from '@/components/layout/ModuleShell'
import { PortalNavbar } from '@/components/layout/PortalNavbar'
import { LoginPage } from '@/pages/LoginPage'
import { PortalPage } from '@/pages/PortalPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DashboardPage } from '@/pages/modules/DashboardPage'
import { InboxPage } from '@/pages/modules/InboxPage'
import { AuditPage } from '@/pages/modules/AuditPage'
import { AccountMapPage } from '@/pages/modules/keuangan/AccountMapPage'
import { BiayaPage } from '@/pages/modules/keuangan/BiayaPage'
import { CoaPage } from '@/pages/modules/keuangan/CoaPage'
import { EFakturPage } from '@/pages/modules/keuangan/EFakturPage'
import { PeriodePage } from '@/pages/modules/keuangan/PeriodePage'
import { RekonBankPage } from '@/pages/modules/keuangan/RekonBankPage'
import { JurnalPage } from '@/pages/modules/keuangan/JurnalPage'
import { KasPage } from '@/pages/modules/keuangan/KasPage'
import { PayrollPage } from '@/pages/modules/keuangan/PayrollPage'
import { PiutangPage } from '@/pages/modules/keuangan/PiutangPage'
import { UtangPage } from '@/pages/modules/keuangan/UtangPage'
import { LaporanPage } from '@/pages/modules/LaporanPage'
import { AbsensiPage } from '@/pages/modules/sdm/AbsensiPage'
import { AbsensiCutiPage } from '@/pages/modules/sdm/AbsensiCutiPage'
import { AbsensiRekapPage } from '@/pages/modules/sdm/AbsensiRekapPage'
import { HrHomePage } from '@/pages/modules/hr/HrHomePage'
import { HrKaryawanPage } from '@/pages/modules/hr/HrKaryawanPage'
import { HrPayrollPage } from '@/pages/modules/hr/HrPayrollPage'
import { HrPersetujuanPage } from '@/pages/modules/hr/HrPersetujuanPage'

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
import { QcPage } from '@/pages/modules/pembelian/QcPage'
import { ReturPage } from '@/pages/modules/pembelian/ReturPage'
import { PenjualanPage } from '@/pages/modules/PenjualanPage'
import { OrderPage } from '@/pages/modules/penjualan/OrderPage'
import { PengirimanPage } from '@/pages/modules/penjualan/PengirimanPage'
import { TagihanPage } from '@/pages/modules/penjualan/TagihanPage'
import { ReturPage as PenjualanReturPage } from '@/pages/modules/penjualan/ReturPage'
import { ProduksiPage } from '@/pages/modules/ProduksiPage'
import { BatchPage } from '@/pages/modules/produksi/BatchPage'
import { InputOutputPage } from '@/pages/modules/produksi/InputOutputPage'
import { PackingPage } from '@/pages/modules/produksi/PackingPage'
import { RendemenPage } from '@/pages/modules/produksi/RendemenPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AuthenticatedProviders />}>
        <Route path="/portal" element={<PortalPage />} />
        <Route
          path="/portal/settings"
          element={
            <div className="min-h-screen bg-surface">
              <PortalNavbar />
              <main className="motion-page mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                <SettingsPage />
              </main>
            </div>
          }
        />

        <Route
          path="/absensi"
          element={
            <ModuleShell
              appName="E-Absensi"
              appTagline="Kehadiran karyawan"
              title="E-Absensi"
              subtitle="Check-in / check-out dan cuti / izin"
              navItems={[
                { to: '/absensi', label: 'Absensi hari ini', end: true },
                { to: '/absensi/cuti', label: 'Cuti & izin' },
                {
                  to: '/absensi/rekap',
                  label: 'Rekap pegawai',
                  roles: ['admin', 'hr'],
                },
              ]}
            />
          }
        >
          <Route index element={<AbsensiPage />} />
          <Route path="cuti" element={<AbsensiCutiPage />} />
          <Route path="pengajuan" element={<Navigate to="/absensi/cuti" replace />} />
          <Route path="riwayat" element={<Navigate to="/absensi/cuti" replace />} />
          <Route path="rekap" element={<AbsensiRekapPage />} />
        </Route>

        <Route element={<RequireAnyRole roles={['admin', 'hr']} />}>
          <Route
            path="/hr"
            element={
              <ModuleShell
                appName="E-HR"
                appTagline="SDM & payroll"
                title="E-HR"
                subtitle="Persetujuan cuti, rekap, roster, dan persiapan gaji"
                navItems={[
                  { to: '/hr', label: 'Beranda', end: true },
                  { to: '/hr/persetujuan', label: 'Persetujuan cuti' },
                  { to: '/hr/rekap', label: 'Rekap kehadiran' },
                  { to: '/hr/karyawan', label: 'Karyawan' },
                  { to: '/hr/payroll', label: 'Persiapan gaji' },
                ]}
              />
            }
          >
            <Route index element={<HrHomePage />} />
            <Route path="persetujuan" element={<HrPersetujuanPage />} />
            <Route path="rekap" element={<AbsensiRekapPage />} />
            <Route path="karyawan" element={<HrKaryawanPage />} />
            <Route path="payroll" element={<HrPayrollPage />} />
            <Route
              path="payroll/persetujuan"
              element={<Navigate to="/hr/payroll" replace />}
            />
          </Route>
        </Route>

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
            path="/app/inbox"
            element={
              <AppShell
                title="Kotak masuk"
                subtitle="Pengajuan menunggu persetujuan, retur, batch, payroll, unlock periode"
              />
            }
          >
            <Route index element={<InboxPage />} />
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
              <Route path="retur" element={<ReturPage />} />
              <Route path="qc" element={<QcPage />} />
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
              <Route path="packing" element={<PackingPage />} />
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
              <Route path="retur" element={<PenjualanReturPage />} />
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
            <Route path="coa" element={<CoaPage />} />
            <Route path="akun-map" element={<AccountMapPage />} />
            <Route path="jurnal" element={<JurnalPage />} />
            <Route path="e-faktur" element={<EFakturPage />} />
            <Route path="periode" element={<PeriodePage />} />
            <Route path="rekon-bank" element={<RekonBankPage />} />
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
                subtitle="Jejak perubahan dokumen dan aksi penting"
              />
            }
          >
            <Route index element={<AuditPage />} />
          </Route>
        </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/portal" replace />} />
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  )
}
