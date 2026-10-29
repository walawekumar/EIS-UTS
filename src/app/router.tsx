import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/RequireAuth'
import { RequireRole } from '@/app/RequireRole'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DashboardPage } from '@/pages/modules/DashboardPage'
import { BiayaPage } from '@/pages/modules/keuangan/BiayaPage'
import { KasPage } from '@/pages/modules/keuangan/KasPage'
import { PiutangPage } from '@/pages/modules/keuangan/PiutangPage'
import { UtangPage } from '@/pages/modules/keuangan/UtangPage'
import { KoreksiPage } from '@/pages/modules/persediaan/KoreksiPage'
import { MutasiPage } from '@/pages/modules/persediaan/MutasiPage'
import { SaldoPage } from '@/pages/modules/persediaan/SaldoPage'
import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'
import { PembelianPage } from '@/pages/modules/PembelianPage'
import { PembayaranPage } from '@/pages/modules/pembelian/PembayaranPage'
import { PencatatanPage } from '@/pages/modules/pembelian/PencatatanPage'
import { PenerimaanPage } from '@/pages/modules/pembelian/PenerimaanPage'

function ModuleBody({ name, notes }: { name: string; notes: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-[0_1px_2px_rgba(20,32,25,0.04)]">
      <ModulePlaceholder moduleName={name} notes={notes} />
    </div>
  )
}

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
              <AppShell title="Pengaturan" subtitle="Profil dan preferensi akun" />
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
            <Route
              index
              element={
                <ModuleBody
                  name="Pemasok & Pelanggan"
                  notes={['Daftar pemasok', 'Daftar pelanggan', 'Kontak & syarat bayar']}
                />
              }
            />
            <Route
              path="produk"
              element={
                <ModuleBody
                  name="Produk & Satuan"
                  notes={['Produk gabah & beras', 'Produk sampingan', 'Satuan & konversi']}
                />
              }
            />
            <Route
              path="pengguna"
              element={
                <ModuleBody
                  name="Pengguna & Peran"
                  notes={['Akun pengguna', 'Pemetaan peran', 'Status aktif/nonaktif']}
                />
              }
            />
          </Route>

          <Route
            path="/app/pembelian"
            element={
              <AppShell
                title="Pembelian Gabah"
                subtitle="Pencatatan, timbang & konfirmasi berat, dan pembayaran pemasok"
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
                subtitle="Batch giling multi-output dan perhitungan rendemen"
              />
            }
          >
            <Route
              index
              element={
                <ModuleBody
                  name="Batch Giling"
                  notes={['Daftar batch aktif', 'Status proses / selesai', 'Operator batch']}
                />
              }
            />
            <Route
              path="input-output"
              element={
                <ModuleBody
                  name="Input–Output"
                  notes={[
                    'Input gabah',
                    'Output beras, menir, dedak, sekam',
                    'Selisih massa',
                  ]}
                />
              }
            />
            <Route
              path="rendemen"
              element={
                <ModuleBody
                  name="Rendemen"
                  notes={['Hitung rendemen', 'Target vs aktual', 'Laporan per batch']}
                />
              }
            />
          </Route>

          <Route
            path="/app/penjualan"
            element={
              <AppShell
                title="Penjualan"
                subtitle="Penjualan, pengiriman, dan tagihan pelanggan"
              />
            }
          >
            <Route
              index
              element={
                <ModuleBody
                  name="Order"
                  notes={['Order pelanggan', 'Alokasi stok', 'Status order']}
                />
              }
            />
            <Route
              path="pengiriman"
              element={
                <ModuleBody
                  name="Pengiriman"
                  notes={['Surat jalan / DO', 'Pengurangan stok', 'Konfirmasi kirim']}
                />
              }
            />
            <Route
              path="tagihan"
              element={
                <ModuleBody
                  name="Tagihan"
                  notes={['Invoice pelanggan', 'Status bayar', 'Jatuh tempo']}
                />
              }
            />
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
            <Route
              path="utang-piutang"
              element={<Navigate to="/app/keuangan/utang" replace />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
