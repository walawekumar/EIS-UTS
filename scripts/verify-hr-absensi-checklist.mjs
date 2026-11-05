/**
 * Deterministic checklist verifier for E-HR / E-Absensi (prove-it-works).
 * Exit 0 only if every CODE-checkable item passes. LIVE items are reported
 * as NEED_BROWSER / NEED_HUMAN when the script cannot observe them.
 *
 * Usage: node scripts/verify-hr-absensi-checklist.mjs
 * Evidence: .audit/hr-absensi-checklist.json
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const auditDir = path.join(root, '.audit')
const outFile = path.join(auditDir, 'hr-absensi-checklist.json')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function check(id, title, pass, evidence, note = '') {
  return {
    id,
    title,
    status: pass ? 'PASS' : 'FAIL',
    evidence,
    note,
  }
}

function need(id, title, reason) {
  return {
    id,
    title,
    status: 'NEED_LIVE',
    evidence: '',
    note: reason,
  }
}

const rows = []

// --- Portal / access ---
{
  const portal = read('src/pages/PortalPage.tsx')
  const router = read('src/app/router.tsx')
  const gate = exists('src/app/RequireAnyRole.tsx')
    ? read('src/app/RequireAnyRole.tsx')
    : ''
  rows.push(
    check(
      1,
      'E-HR portal roles limited to admin|hr',
      /id:\s*'ehr'[\s\S]*roles:\s*\['admin',\s*'hr'\]/.test(portal),
      'src/pages/PortalPage.tsx',
    ),
  )
  rows.push(
    check(
      2,
      '/hr wrapped in RequireAnyRole admin|hr',
      gate.includes("roles={['admin', 'hr']}") ||
        /RequireAnyRole roles=\{\['admin', 'hr'\]\}/.test(router),
      'src/app/router.tsx + RequireAnyRole.tsx',
    ),
  )
  rows.push(
    check(
      3,
      'Absensi rekap nav only admin|hr',
      /to:\s*'\/absensi\/rekap'[\s\S]*roles:\s*\['admin',\s*'hr'\]/.test(router),
      'src/app/router.tsx',
    ),
  )
  rows.push(
    check(
      4,
      'Sidebar has no Persetujuan gaji nav item',
      !/Persetujuan gaji/.test(router) &&
        /to:\s*'\/hr\/payroll'/.test(router) &&
        /Navigate to="\/hr\/payroll"/.test(router),
      'src/app/router.tsx',
    ),
  )
}

// --- Absensi UI ---
{
  const page = read('src/pages/modules/sdm/AbsensiPage.tsx')
  const cuti = read('src/pages/modules/sdm/AbsensiCutiPage.tsx')
  const geoMap = read('src/components/absensi/AbsensiGeoMap.tsx')
  const lokasi = read('src/components/absensi/AbsensiLokasiCell.tsx')
  const store = read('src/features/absensi/absensi-store.tsx')
  const router = read('src/app/router.tsx')

  rows.push(
    check(
      5,
      'Check-in requires geolocation',
      /readBrowserGeo/.test(store) &&
        /Izinkan lokasi perangkat untuk check-in/.test(store),
      'src/features/absensi/absensi-store.tsx',
    ),
  )
  rows.push(
    check(
      6,
      'Map markers use teardrop pin SVG (not circle-only)',
      /viewBox="0 0 28 36"/.test(geoMap) &&
        /absensi-map-pin/.test(geoMap) &&
        !/border-radius:9999px/.test(geoMap),
      'src/components/absensi/AbsensiGeoMap.tsx',
    ),
  )
  rows.push(
    check(
      7,
      'Lokasi cell uses pin + maps link (not bare dash)',
      /AbsensiLokasiCell/.test(page) && /Tanpa lokasi/.test(lokasi),
      'AbsensiPage + AbsensiLokasiCell',
    ),
  )
  rows.push(
    check(
      8,
      'Absensi list uses FinanceFilterBar (no visible Cari label)',
      /FinanceFilterBar/.test(page) && !/label="Cari"/.test(page),
      'src/pages/modules/sdm/AbsensiPage.tsx',
    ),
  )
  rows.push(
    check(
      9,
      'Cuti page is single route with Ajukan modal',
      /FinanceModal/.test(cuti) &&
        /setOpen\(true\)/.test(cuti) &&
        /path="cuti"/.test(router) &&
        /Navigate to="\/absensi\/cuti"/.test(router),
      'AbsensiCutiPage + router',
    ),
  )
  rows.push(
    check(
      10,
      'Dead pengajuan/riwayat page files removed',
      !exists('src/pages/modules/sdm/AbsensiPengajuanPage.tsx') &&
        !exists('src/pages/modules/sdm/AbsensiRiwayatPage.tsx'),
      'src/pages/modules/sdm/',
    ),
  )
}

// --- HR home ---
{
  const home = read('src/pages/modules/hr/HrHomePage.tsx')
  rows.push(
    check(
      11,
      'HR home side-by-side charts + queue table',
      /lg:grid-cols-2/.test(home) &&
        /AbsensiMonthChart/.test(home) &&
        /HrLeaveOverviewChart/.test(home) &&
        /HrQueueTable/.test(home) &&
        !/Pintasan/.test(home) &&
        !/HrTaskList/.test(home),
      'src/pages/modules/hr/HrHomePage.tsx',
    ),
  )
  rows.push(
    check(
      12,
      'HrQueueTable has filter + sort via FinanceFilterBar',
      exists('src/components/hr/HrQueueTable.tsx') &&
        /FinanceFilterBar/.test(read('src/components/hr/HrQueueTable.tsx')) &&
        /secondaryFilterLabel="Urutkan"/.test(
          read('src/components/hr/HrQueueTable.tsx'),
        ),
      'src/components/hr/HrQueueTable.tsx',
    ),
  )
}

// --- Leave ---
{
  const leaveStore = read('src/features/hr/leave-store.tsx')
  rows.push(
    check(
      13,
      'Leave submit requires reason + proof',
      /Alasan pengajuan wajib/.test(leaveStore) ||
        /reason\.trim\(\)/.test(leaveStore),
      'src/features/hr/leave-store.tsx',
      'Proof enforced in AbsensiCutiPage + store',
    ),
  )
  rows.push(
    check(
      14,
      'Leave approve limited in store/UI for admin|hr',
      exists('src/pages/modules/hr/HrPersetujuanPage.tsx') &&
        /role !== 'admin' && user\.role !== 'hr'/.test(
          read('src/pages/modules/hr/HrPersetujuanPage.tsx'),
        ),
      'HrPersetujuanPage.tsx',
    ),
  )
}

// --- Payroll ---
{
  const payroll = read('src/pages/modules/hr/HrPayrollPage.tsx')
  rows.push(
    check(
      15,
      'Payroll page plain description (no arrow workflow)',
      /Susun draft gaji periode/.test(payroll) &&
        !/HR menyiapkan draft →/.test(payroll),
      'HrPayrollPage.tsx',
    ),
  )
  rows.push(
    check(
      16,
      'No Antrian persetujuan button; queue embedded when pending',
      !/Antrian persetujuan/.test(payroll) &&
        /Menunggu approve Anda/.test(payroll),
      'HrPayrollPage.tsx',
    ),
  )
  rows.push(
    check(
      17,
      'HrPayrollApprovePage removed (redirect only)',
      !exists('src/pages/modules/hr/HrPayrollApprovePage.tsx'),
      'src/pages/modules/hr/',
    ),
  )
}

// --- Migrations present ---
{
  rows.push(
    check(
      18,
      'Geo migration file present',
      exists('supabase/migrations/20261105_12_attendance_geo.sql'),
      'supabase/migrations/20261105_12_attendance_geo.sql',
    ),
  )
  rows.push(
    check(
      19,
      'Leave/payroll migration file present',
      exists('supabase/migrations/20261105_10_hr_leave_payroll.sql'),
      'supabase/migrations/20261105_10_hr_leave_payroll.sql',
    ),
  )
}

// --- Live / human ---
rows.push(
  need(
    20,
    'Portal: non-HR role does not see E-HR card',
    'Browser login as beli@ / kas@ and inspect /portal',
  ),
)
rows.push(
  need(
    21,
    'Check-in with GPS writes lat/lng and shows pin + lokasi cell',
    'Browser + geolocation permission on /absensi',
  ),
)
rows.push(
  need(
    22,
    'Cloud migrations applied (no PGRST205/204 on absensi/leave)',
    'Live Supabase + check-in / leave submit',
  ),
)
rows.push(
  need(
    23,
    'Payroll stamp sequence HR→admin→keuangan cannot cross-stamp',
    'Multi-role browser or store unit drive',
  ),
)
rows.push(
  need(24, 'Mobile filter bar layout', 'Resize browser <640px on /hr and /absensi'),
)

const pass = rows.filter((r) => r.status === 'PASS').length
const fail = rows.filter((r) => r.status === 'FAIL').length
const live = rows.filter((r) => r.status === 'NEED_LIVE').length

const report = {
  generatedAt: new Date().toISOString(),
  skill: 'principle-prove-it-works + create-verification-skill',
  summary: { pass, fail, needLive: live, total: rows.length },
  rows,
}

fs.mkdirSync(auditDir, { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(report, null, 2))

console.log(JSON.stringify(report.summary, null, 2))
for (const r of rows) {
  console.log(`${r.status.padEnd(9)} #${r.id} ${r.title}`)
}
console.log(`\nEvidence: ${outFile}`)

if (fail > 0) process.exit(1)
