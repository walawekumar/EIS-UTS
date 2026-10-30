import { useEffect, useId, useState } from 'react'
import { FinanceModal, ModalActions } from '@/components/keuangan/FinanceModal'
import { TextField } from '@/components/ui/TextField'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Dialog konfirmasi custom — pengganti window.confirm */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Ya',
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <FinanceModal
      title={title}
      subtitle="Konfirmasi"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          danger={danger}
        />
      }
    >
      {description ? (
        <p className="text-[13px] leading-relaxed text-muted">{description}</p>
      ) : (
        <p className="text-[13px] text-muted">Lanjutkan tindakan ini?</p>
      )}
    </FinanceModal>
  )
}

type PromptDialogProps = {
  open: boolean
  title: string
  description?: string
  label?: string
  placeholder?: string
  confirmLabel?: string
  danger?: boolean
  required?: boolean
  /** Error from parent after confirm (e.g. API validation) */
  submitError?: string
  onConfirm: (value: string) => void
  onClose: () => void
}

/** Dialog input teks — pengganti window.prompt */
export function PromptDialog({
  open,
  title,
  description,
  label = 'Alasan',
  placeholder = 'Tulis alasan…',
  confirmLabel = 'Lanjut',
  danger = false,
  required = true,
  submitError,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const fieldId = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!open) return
    setValue('')
    setError(undefined)
  }, [open])

  if (!open) return null

  function submit() {
    const trimmed = value.trim()
    if (required && !trimmed) {
      setError('Wajib diisi')
      return
    }
    onConfirm(trimmed)
  }

  return (
    <FinanceModal
      title={title}
      subtitle="Konfirmasi"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={submit}
          confirmLabel={confirmLabel}
          danger={danger}
        />
      }
    >
      {description ? (
        <p className="mb-3 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      <TextField
        id={fieldId}
        label={label}
        requiredMark={required}
        value={value}
        placeholder={placeholder}
        error={error ?? submitError}
        autoFocus
        onChange={(e) => {
          setValue(e.target.value)
          setError(undefined)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
      />
    </FinanceModal>
  )
}
