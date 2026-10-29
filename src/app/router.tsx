import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/RequireAuth'
import { RequireRole } from '@/app/RequireRole'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DashboardPage } from '@/pages/modules/DashboardPage'
import { ModulePlaceholder } from '@/pages/modules/ModulePlaceholder'

function ModuleBody({ name, notes }: { name: string; notes: string[] }) {
  return (
    <div className="border border-line bg-panel p-5">
      <ModulePlaceholder moduleName={name} notes={notes} />
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        {/* Portal disembunyikan */}
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
                  name="Master Data"
                  notes={['Pemasok & pelanggan', 'Produk & satuan', 'Pengguna & peran']}
                />
              }
            />
          </Route>

          <Route
            path="/app/pembelian"
            element={
              <AppShell
                title="Pembelian"
                subtitle="Pembelian dan penerimaan gabah dari pemasok"
              />
            }
          >
            <Route
              index
              element={
                <ModuleBody
                  name="Pembelian"
                  notes={[
                    'Pencatatan pembelian gabah',
                    'Penerimaan & konfirmasi berat',
                    'Status pembayaran ke pemasok',
                  ]}
                />
              }
            />
          </Route>

          <Route
            path="/app/persediaan"
            element={
              <AppShell
                title="Persediaan"
                subtitle="Saldo dan mutasi bahan baku serta produk"
              />
            }
          >
            <Route
              index
              element={
                <ModuleBody
                  name="Persediaan"
                  notes={['Saldo bahan baku & produk', 'Mutasi stok', 'Koreksi dengan alasan']}
                />
              }
            />
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
                  name="Produksi"
                  notes={[
                    'Batch produksi multi-output',
                    'Input gabah → beras, menir, dedak, sekam',
                    'Hitung rendemen & selisih massa',
                  ]}
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
                  name="Penjualan"
                  notes={[
                    'Order penjualan',
                    'Pengiriman & pengurangan stok',
                    'Tagihan pelanggan',
                  ]}
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
            <Route
              index
              element={
                <ModuleBody
                  name="Keuangan"
                  notes={['Kas masuk/keluar', 'Utang & piutang', 'Biaya operasional dasar']}
                />
              }
            />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  )
}
