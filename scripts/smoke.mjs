/**
 * Smoke E-Gabah. Jalankan: npm run smoketest
 * Tanpa build: npm run smoketest-no-compile
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let failed = 0

function pass(name) {
  console.log(`PASS  ${name}`)
}

function fail(name, detail) {
  failed += 1
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

const checklist = spawnSync(process.execPath, ['scripts/verify-hr-absensi-checklist.mjs'], {
  cwd: root,
  encoding: 'utf8',
})
if (checklist.status === 0) pass('checklist hr/absensi')
else fail('checklist hr/absensi', 'lihat baris FAIL di atas')
if (checklist.stdout) process.stdout.write(checklist.stdout)

const src = path.join(root, 'src')
function walk(dir, hits, pred) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, hits, pred)
    else if (pred(full)) hits.push(full)
  }
}

const alerts = []
walk(src, alerts, (file) => file.endsWith('.tsx') || file.endsWith('.ts'))
const alertFiles = alerts.filter((file) =>
  /window\.alert\(/.test(fs.readFileSync(file, 'utf8')),
)
if (alertFiles.length === 0) pass('tidak ada window.alert')
else fail('tidak ada window.alert', alertFiles.map((f) => path.relative(root, f)).join(', '))

const ops = fs.readFileSync(path.join(src, 'components/ops/OpsChrome.tsx'), 'utf8')
if (!/<select[\s>]/.test(ops)) pass('OpsSelect bukan select bawaan')
else fail('OpsSelect bukan select bawaan')

const settingsCloud = fs.existsSync(
  path.join(src, 'features/settings/settings-cloud.ts'),
)
const migration = fs.existsSync(
  path.join(root, 'supabase/migrations/20261105_13_app_settings_create_user.sql'),
)
if (settingsCloud && migration) pass('pengaturan dan akun cabang ada di kode')
else fail('pengaturan dan akun cabang ada di kode')

function loadDatabaseUrl() {
  const envFile = path.join(root, '.env.local')
  if (!fs.existsSync(envFile)) return null
  const line = fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((row) => row.startsWith('DATABASE_URL='))
  if (!line) return null
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
}

const databaseUrl = loadDatabaseUrl()
if (!databaseUrl) {
  console.log('SKIP  tabel cloud (DATABASE_URL tidak ada)')
} else {
  const env = { ...process.env }
  let parsed = true
  try {
    const withoutScheme = databaseUrl.replace(/^postgres(ql)?:\/\//, '')
    const at = withoutScheme.lastIndexOf('@')
    const userinfo = withoutScheme.slice(0, at)
    const hostpart = withoutScheme.slice(at + 1)
    const colon = userinfo.indexOf(':')
    env.PGUSER = decodeURIComponent(userinfo.slice(0, colon))
    env.PGPASSWORD = decodeURIComponent(userinfo.slice(colon + 1))
    const hostOnly = hostpart.split('/')[0]
    const dbAndQuery = hostpart.split('/').slice(1).join('/')
    env.PGDATABASE = dbAndQuery.split('?')[0]
    env.PGHOST = hostOnly.split(':')[0]
    env.PGPORT = hostOnly.includes(':') ? hostOnly.split(':')[1] : '5432'
    env.PGSSLMODE = 'require'
  } catch {
    parsed = false
    fail('tabel cloud inti ada', 'DATABASE_URL tidak bisa dibaca')
  }
  if (parsed) {
    const query = spawnSync(
      'psql',
      [
        '-v',
        'ON_ERROR_STOP=1',
        '-tAc',
        `select string_agg(name, ',') from (
           select to_regclass(t)::text as name
           from unnest(array[
             'public.app_settings',
             'public.profiles',
             'public.attendance_records',
             'public.leave_requests',
             'public.stock_balances',
             'public.cash_entries'
           ]) as t
         ) s where name is not null;`,
      ],
      { encoding: 'utf8', env },
    )
    const found = (query.stdout ?? '').trim()
    const needed = [
      'app_settings',
      'profiles',
      'attendance_records',
      'leave_requests',
      'stock_balances',
      'cash_entries',
    ]
    const missing = needed.filter((name) => !found.includes(name))
    if (query.status === 0 && missing.length === 0) pass('tabel cloud inti ada')
    else fail('tabel cloud inti ada', missing.join(', ') || 'psql gagal')
  }
}

if (failed > 0) {
  console.log(`\nsmoke: ${failed} gagal`)
  process.exit(1)
}
console.log('\nsmoke: lulus')
