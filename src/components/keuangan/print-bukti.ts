import { formatIdr } from '@/features/keuangan/keuangan-data'

export type PrintField = { label: string; value: string }

export function printBukti(title: string, fields: PrintField[]) {
  const rows = fields
    .map(
      (f) =>
        `<tr><td style="padding:8px 0;color:#5f6d65;width:38%">${escapeHtml(
          f.label,
        )}</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(
          f.value,
        )}</td></tr>`,
    )
    .join('')

  const win = window.open('', '_blank', 'width=520,height=640')
  if (!win) return false

  win.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1a211d; padding: 28px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #5f6d65; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .brand { font-size: 12px; font-weight: 600; color: #1a4d36; letter-spacing: .04em; text-transform: uppercase; }
    .foot { margin-top: 28px; font-size: 11px; color: #5f6d65; }
  </style>
</head>
<body>
  <div class="brand">E-Gabah · Keuangan</div>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">Bukti transaksi (cetak MVP)</p>
  <table>${rows}</table>
  <p class="foot">Dicetak ${new Date().toLocaleString('id-ID')}</p>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
  win.document.close()
  return true
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function moneyOrDash(value: number | undefined) {
  if (value === undefined) return '—'
  return formatIdr(value)
}
