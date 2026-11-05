# Absensi geolocation

Check-in needs GPS. Map uses pin markers. Lokasi column shows pin + link.

## Sub-features

- `geo-required` — denied location blocks check-in
- `pin-marker` — map marker is teardrop SVG class `absensi-map-pin`
- `lokasi-cell` — table shows `AbsensiLokasiCell`, not bare `—` for new rows
- `filter-bar` — list uses FinanceFilterBar without visible label `Cari`

## How to get to it (user POV)

Open `/absensi` after login.

## Driving it with browser

Preconditions: geolocation grantable in the browser profile.

- Snapshot `/absensi`: search field has `sr-only` Cari only; Filter + Urutkan present.
- Grant geo, click Check-in, then assert lokasi cell is not `Tanpa lokasi` for today's row.
- Map pane shows pin (not only a 14px circle).

## Gotchas

- Old rows without geo correctly show `Tanpa lokasi`.
- Cloud missing geo columns yields persist toast; treat as NEED_LIVE cloud failure.
