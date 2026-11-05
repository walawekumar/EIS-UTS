# Spek: Kalender ops-derived + polish UI rekon bank / periode

Tanggal: 2026-10-30  
Status: approved (user: gas — derive ops + polish visual & alur)

## Tujuan

1. MiniCalendar dashboard menampilkan agenda dari data operasional nyata (bukan hardcode `CALENDAR_EVENTS`).
2. Halaman Rekon bank dan Tutup periode lebih jelas secara layout + alur (step strip, empty state, ringkasan), tanpa mengubah aturan bisnis.

## Non-tujuan

- Tabel `calendar_events` baru
- Wizard multi-route terpisah
- Perubahan matching CSV / unlock role matrix / period gate

## Kalender

- Ganti sumber: `buildOpsCalendarEvents` dari purchases (dueDate), sale orders (dueDate), lot QC / batch aktif, period locks aktif, payables/receivables due bila ada.
- Event: `{ id, title, meta, tone, date: YYYY-MM-DD }` — absolute date.
- Tone: `deadline` | `ops` | `info`.
- `MiniCalendar` + `buildEventMap` disesuaikan ke `date` bukan `dayOffset`.
- Dashboard wire context yang sudah ada; empty → pesan “Tidak ada agenda”.

## UI Rekon bank

- Step strip: Sesi → Import CSV → Match → Ringkas.
- Empty state jika belum ada sesi.
- Header ringkas: unmatched / matched / ignored counts.

## UI Periode

- Step strip: Kunci → Dampak → Unlock.
- Empty state jika belum ada kunci.
- Status pill / copy lebih jelas; layout tetap pola FinanceTable/panel.

## Verifikasi

- `tsc` exit 0
- Calendar: hari dengan due date ops punya dot/event
- Bank/periode: step + empty state terlihat; CRUD lama tetap jalan
