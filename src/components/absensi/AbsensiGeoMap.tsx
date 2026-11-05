import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PageSection } from '@/components/ui/PageSection'
import {
  formatClock,
  hasGeo,
  type AttendanceRecord,
} from '@/features/absensi/absensi-data'

export type AbsensiMapPin = {
  id: string
  lat: number
  lng: number
  label: string
  sublabel?: string
  kind: 'in' | 'out'
}

type AbsensiGeoMapProps = {
  title: string
  subtitle?: string
  pins: AbsensiMapPin[]
  emptyHint?: string
  className?: string
  /** Tinggi area peta (kelas Tailwind). */
  mapClassName?: string
  showLegend?: boolean
}

function pinIcon(kind: 'in' | 'out') {
  const fill = kind === 'in' ? '#1a4d36' : '#2563a8'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
    <path d="M14 0C6.8 0 1 5.8 1 13c0 9.2 11.2 21.4 12.2 22.5a1.2 1.2 0 0 0 1.7 0C16 34.4 27 22.2 27 13 27 5.8 21.2 0 14 0z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="4.2" fill="#fff"/>
  </svg>`
  return L.divIcon({
    className: 'absensi-map-pin',
    html: svg,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
}

export function pinsFromRecords(
  records: AttendanceRecord[],
  opts?: { userId?: string },
): AbsensiMapPin[] {
  const pins: AbsensiMapPin[] = []
  for (const r of records) {
    if (opts?.userId && r.userId !== opts.userId) continue
    if (hasGeo(r.checkInGeo)) {
      pins.push({
        id: `${r.id}-in`,
        lat: r.checkInGeo!.lat,
        lng: r.checkInGeo!.lng,
        label: r.userName,
        sublabel: `Masuk ${r.date} · ${formatClock(r.checkIn)}`,
        kind: 'in',
      })
    }
    if (hasGeo(r.checkOutGeo)) {
      pins.push({
        id: `${r.id}-out`,
        lat: r.checkOutGeo!.lat,
        lng: r.checkOutGeo!.lng,
        label: r.userName,
        sublabel: `Keluar ${r.date} · ${formatClock(r.checkOut)}`,
        kind: 'out',
      })
    }
  }
  return pins
}

export function AbsensiGeoMap({
  title,
  subtitle,
  pins,
  emptyHint = 'Belum ada titik lokasi absensi.',
  className,
  mapClassName = 'h-[280px] w-full sm:h-[320px]',
  showLegend = true,
}: AbsensiGeoMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  const center = useMemo((): [number, number] => {
    if (!pins.length) return [-7.566, 110.85]
    const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length
    const lng = pins.reduce((s, p) => s + p.lng, 0) / pins.length
    return [lat, lng]
  }, [pins])

  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return
    const map = L.map(host, {
      zoomControl: true,
      attributionControl: true,
    }).setView([-7.566, 110.85], 6)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    for (const pin of pins) {
      L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.kind) })
        .bindPopup(
          `<strong>${pin.label}</strong><br/><span style="font-size:12px">${pin.sublabel ?? ''}</span>`,
        )
        .addTo(layer)
    }
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 16)
    } else if (pins.length > 1) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds.pad(0.2))
    } else {
      map.setView(center, 6)
    }
    window.setTimeout(() => map.invalidateSize(), 80)
  }, [pins, center])

  return (
    <PageSection
      flush
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        showLegend ? (
          <div className="flex gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <svg width="12" height="16" viewBox="0 0 28 36" aria-hidden>
                <path
                  d="M14 0C6.8 0 1 5.8 1 13c0 9.2 11.2 21.4 12.2 22.5a1.2 1.2 0 0 0 1.7 0C16 34.4 27 22.2 27 13 27 5.8 21.2 0 14 0z"
                  className="fill-brand-800"
                />
              </svg>
              Masuk
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="12" height="16" viewBox="0 0 28 36" aria-hidden>
                <path
                  d="M14 0C6.8 0 1 5.8 1 13c0 9.2 11.2 21.4 12.2 22.5a1.2 1.2 0 0 0 1.7 0C16 34.4 27 22.2 27 13 27 5.8 21.2 0 14 0z"
                  className="fill-sky-600"
                />
              </svg>
              Keluar
            </span>
          </div>
        ) : null
      }
    >
      <div className="relative">
        <div ref={hostRef} className={mapClassName} />
        {pins.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-panel/70 px-4 text-center text-[13px] text-muted">
            {emptyHint}
          </div>
        ) : null}
      </div>
    </PageSection>
  )
}
