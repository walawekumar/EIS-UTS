import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
} from '@/lib/cloudinary-upload'

export type ReceiptValue = {
  name: string
  size: number
  previewUrl: string
  mime: string
  /** Cloudinary (atau remote) URL bila upload berhasil. */
  url?: string
} | null

/** Nilai yang disimpan ke snapshot / DB. */
export function receiptPersistRef(value: ReceiptValue): string | undefined {
  if (!value) return undefined
  return value.url ?? value.name
}

type ReceiptUploadProps = {
  value: ReceiptValue
  onChange: (value: ReceiptValue) => void
  label?: string
  hint?: string
  error?: string
  requiredMark?: boolean
}

const MAX_BYTES = 3 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf'

function revoke(url: string | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function ReceiptUpload({
  value,
  onChange,
  label = 'Bukti / struk',
  hint = 'Wajib dilampirkan · JPG, PNG, WEBP, atau PDF · maks. 3 MB',
  error,
  requiredMark,
}: ReceiptUploadProps) {
  const id = useId()
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function clear() {
    revoke(value?.previewUrl)
    onChange(null)
    setUploadError(null)
    if (galleryRef.current) galleryRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  async function applyFile(file: File | undefined) {
    if (!file) return
    const okType =
      ACCEPT.split(',').includes(file.type) ||
      file.type.startsWith('image/') ||
      file.type === 'application/pdf'
    if (!okType) {
      onChange(null)
      setUploadError('Tipe file tidak didukung.')
      return
    }
    if (file.size > MAX_BYTES) {
      onChange(null)
      setUploadError('File melebihi 3 MB.')
      return
    }
    revoke(value?.previewUrl)
    setUploadError(null)
    const previewUrl = URL.createObjectURL(file)
    const local: NonNullable<ReceiptValue> = {
      name: file.name || `bukti-${Date.now()}.jpg`,
      size: file.size,
      previewUrl,
      mime: file.type || 'image/jpeg',
    }
    onChange(local)

    if (!isCloudinaryConfigured()) return

    setUploading(true)
    try {
      const remote = await uploadToCloudinary(file)
      revoke(previewUrl)
      onChange({
        ...local,
        previewUrl: remote.url,
        url: remote.url,
        size: remote.bytes || local.size,
      })
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : 'Upload gagal; memakai salinan lokal.',
      )
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void applyFile(event.target.files?.[0])
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    void applyFile(event.dataTransfer.files?.[0])
  }

  const isImage = Boolean(value?.mime.startsWith('image/'))
  const showError = error || uploadError

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">
        {label}
        {requiredMark ? <span className="ml-0.5 text-brand-600">*</span> : null}
      </p>

      {value ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
          {isImage ? (
            <div className="flex max-h-44 items-center justify-center bg-ink/5 p-2">
              <img
                src={value.previewUrl}
                alt={value.name}
                className="max-h-40 max-w-full rounded-lg object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-[11px] font-semibold text-brand-800">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  {value.name}
                </p>
                <p className="font-mono text-[11px] text-muted">
                  {(value.size / 1024).toFixed(0)} KB
                  {value.url ? ' · cloud' : ''}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <p className="min-w-0 truncate text-[12px] text-muted">
              {uploading
                ? 'Mengunggah ke Cloudinary…'
                : value.url
                  ? 'Tersimpan di cloud'
                  : value.name}
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={uploading}
                onClick={() => galleryRef.current?.click()}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-brand-800 transition hover:bg-brand-50 disabled:opacity-50"
              >
                Ganti
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={clear}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={[
            'rounded-xl border border-dashed px-3 py-4 text-center transition',
            showError
              ? 'border-red-300 bg-red-50/40'
              : 'border-line bg-surface/50 hover:border-brand-300',
          ].join(' ')}
        >
          <span className="mx-auto mb-2 flex size-9 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
            <UploadIcon />
          </span>
          <p className="text-[13px] font-medium text-ink">Lampirkan bukti</p>
          <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-800 px-3 text-[12px] font-semibold text-white transition hover:bg-brand-900"
            >
              <CameraIcon />
              Ambil foto
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12px] font-medium text-ink transition hover:bg-brand-50"
            >
              <GalleryIcon />
              Dari galeri
            </button>
          </div>
        </div>
      )}

      <input
        ref={galleryRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
      />

      {showError ? (
        <p className="mt-1.5 text-xs text-red-600">{showError}</p>
      ) : null}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 16V6" />
      <path d="M8 9l4-4 4 4" />
      <path d="M4 18h16" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
