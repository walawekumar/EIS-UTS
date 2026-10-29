import { useId, useRef, type ChangeEvent, type DragEvent } from 'react'

export type ReceiptValue = {
  name: string
  size: number
  previewUrl: string
  mime: string
} | null

type ReceiptUploadProps = {
  value: ReceiptValue
  onChange: (value: ReceiptValue) => void
  label?: string
  hint?: string
  error?: string
}

const MAX_BYTES = 3 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

function revoke(url: string | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function ReceiptUpload({
  value,
  onChange,
  label = 'Upload struk / bukti',
  hint = 'JPG, PNG, WEBP, atau PDF · maks. 3 MB',
  error,
}: ReceiptUploadProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  function clear() {
    revoke(value?.previewUrl)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function applyFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type) && !file.type.startsWith('image/')) {
      onChange(null)
      return
    }
    if (file.size > MAX_BYTES) {
      onChange(null)
      return
    }
    revoke(value?.previewUrl)
    const previewUrl = URL.createObjectURL(file)
    onChange({
      name: file.name,
      size: file.size,
      previewUrl,
      mime: file.type,
    })
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    applyFile(event.target.files?.[0])
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    applyFile(event.dataTransfer.files?.[0])
  }

  const isImage = value?.mime.startsWith('image/')

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">{label}</p>

      {value ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
          {isImage ? (
            <div className="flex max-h-40 items-center justify-center bg-ink/5 p-2">
              <img
                src={value.previewUrl}
                alt={value.name}
                className="max-h-36 max-w-full rounded-lg object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-[11px] font-semibold text-brand-800">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{value.name}</p>
                <p className="font-mono text-[11px] text-muted">
                  {(value.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <p className="min-w-0 truncate text-[12px] text-muted">{value.name}</p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-brand-800 transition hover:bg-brand-50"
              >
                Ganti
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-red-700 transition hover:bg-red-50"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-5 text-center transition',
            error
              ? 'border-red-300 bg-red-50/40'
              : 'border-line bg-surface/50 hover:border-brand-300 hover:bg-brand-50/40',
          ].join(' ')}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
            <UploadIcon />
          </span>
          <span className="text-[13px] font-medium text-ink">
            Seret struk ke sini atau klik untuk unggah
          </span>
          <span className="text-[11px] text-muted">{hint}</span>
        </label>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M12 16V6" />
      <path d="M8 9l4-4 4 4" />
      <path d="M4 18h16" />
    </svg>
  )
}
