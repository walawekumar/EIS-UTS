import { hasGeo, type GeoPoint } from '@/features/absensi/absensi-data'

function mapsUrl(geo: GeoPoint): string {
  return `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=17/${geo.lat}/${geo.lng}`
}

export function AbsensiLokasiCell({ geo }: { geo?: GeoPoint }) {
  if (!hasGeo(geo)) {
    return <span className="text-[12px] text-muted">Tanpa lokasi</span>
  }

  return (
    <a
      href={mapsUrl(geo!)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-800 hover:underline"
      title={`${geo!.lat.toFixed(5)}, ${geo!.lng.toFixed(5)}`}
    >
      <svg width="12" height="16" viewBox="0 0 28 36" aria-hidden className="shrink-0">
        <path
          d="M14 0C6.8 0 1 5.8 1 13c0 9.2 11.2 21.4 12.2 22.5a1.2 1.2 0 0 0 1.7 0C16 34.4 27 22.2 27 13 27 5.8 21.2 0 14 0z"
          className="fill-brand-800"
        />
        <circle cx="14" cy="13" r="4.2" fill="#fff" />
      </svg>
      <span className="font-mono tabular-nums">
        {geo!.lat.toFixed(3)}, {geo!.lng.toFixed(3)}
      </span>
    </a>
  )
}
