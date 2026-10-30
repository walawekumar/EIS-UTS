import { readAppSettings } from '@/features/settings/app-settings'
import { formatIdr } from '@/features/keuangan/keuangan-data'

export type PrintField = { label: string; value: string }

export function printBukti(
  title: string,
  fields: PrintField[],
  options?: { subtitle?: string; module?: string },
) {
  const settings = readAppSettings()
  const { company, docs, profile } = settings

  const subtitle = options?.subtitle ?? 'Bukti transaksi'
  const moduleLabel = options?.module ?? 'Keuangan'
  const printedAt = new Date().toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const highlight = fields.slice(0, 1)
  const rest = fields.slice(1)

  const hero =
    highlight.length > 0
      ? `<div class="hero">
          <p class="hero-label">${escapeHtml(highlight[0].label)}</p>
          <p class="hero-value">${escapeHtml(highlight[0].value)}</p>
        </div>`
      : ''

  const rows = rest
    .map(
      (f) =>
        `<div class="row">
          <span class="label">${escapeHtml(f.label)}</span>
          <span class="value">${escapeHtml(f.value)}</span>
        </div>`,
    )
    .join('')

  const npwpBlock =
    docs.showNpwp && company.npwp.trim()
      ? `<p class="company-meta">NPWP ${escapeHtml(company.npwp.trim())}</p>`
      : ''

  const bankBlock =
    docs.showBank && company.bankAccount.trim()
      ? `<p class="company-meta">${escapeHtml(company.bankName)} · ${escapeHtml(company.bankAccount)} · ${escapeHtml(company.bankHolder)}</p>`
      : ''

  const signatureBlock = docs.showSignature
    ? `<div class="signs">
      <div class="sign">
        <div class="sign-line"></div>
        Dibuat oleh
        ${profile.signatureName.trim() ? `<div class="sign-name">${escapeHtml(profile.signatureName.trim())}</div>` : ''}
      </div>
      <div class="sign">
        <div class="sign-line"></div>
        Diperiksa / diterima
      </div>
    </div>`
    : ''

  const footerText = docs.printFooter.trim()

  const win = window.open('', '_blank', 'width=560,height=720')
  if (!win) return false

  win.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
      color: #1a211d;
      background: #f0f4f1;
      padding: 24px;
    }
    .sheet {
      max-width: 440px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d5e0d9;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 28px rgba(20, 32, 25, 0.08);
    }
    .top {
      padding: 18px 22px 16px;
      background: linear-gradient(160deg, #e3f4eb 0%, #fff 70%);
      border-bottom: 1px solid #d5e0d9;
    }
    .brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1a4d36;
    }
    .company-meta {
      margin: 6px 0 0;
      font-size: 10.5px;
      line-height: 1.45;
      color: #5f6d65;
    }
    .module {
      margin-top: 8px;
      font-size: 11px;
      color: #5f6d65;
    }
    h1 {
      margin: 12px 0 4px;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 0;
      font-size: 12.5px;
      color: #5f6d65;
    }
    .body { padding: 18px 22px 8px; }
    .hero {
      margin-bottom: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #f2faf6;
      border: 1px solid #c5e6d5;
    }
    .hero-label {
      margin: 0;
      font-size: 11px;
      color: #5f6d65;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .hero-value {
      margin: 6px 0 0;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 22px;
      font-weight: 650;
      color: #143325;
      letter-spacing: -0.02em;
    }
    .card {
      border: 1px solid #d5e0d9;
      border-radius: 12px;
      overflow: hidden;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border-bottom: 1px solid #e8eee9;
      font-size: 13px;
    }
    .row:last-child { border-bottom: 0; }
    .label { color: #5f6d65; flex-shrink: 0; }
    .value {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }
    .signs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 22px 22px 8px;
    }
    .sign {
      text-align: center;
      font-size: 11px;
      color: #5f6d65;
    }
    .sign-line {
      margin: 36px auto 8px;
      width: 78%;
      border-top: 1px solid #b8c7be;
    }
    .sign-name {
      margin-top: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #1a211d;
    }
    .foot {
      padding: 8px 22px 6px;
      font-size: 11px;
      color: #5f6d65;
      text-align: center;
      line-height: 1.45;
    }
    .foot:last-child { padding-bottom: 18px; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; border: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="brand">${escapeHtml(company.brand || company.name)}</div>
      ${npwpBlock}
      ${bankBlock}
      <div class="module">${escapeHtml(moduleLabel)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(subtitle)}</p>
    </div>
    <div class="body">
      ${hero}
      <div class="card">${rows}</div>
    </div>
    ${signatureBlock}
    ${footerText ? `<p class="foot">${escapeHtml(footerText)}</p>` : ''}
    <p class="foot">Dicetak ${escapeHtml(printedAt)}</p>
  </div>
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
