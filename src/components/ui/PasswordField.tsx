import { useState } from 'react'
import { TextField } from '@/components/ui/TextField'
import { EyeIcon, EyeOffIcon, LockIcon } from '@/components/ui/icons'

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  requiredMark?: boolean
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required,
  requiredMark,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      id={id}
      label={label}
      requiredMark={requiredMark}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      leading={<LockIcon />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md p-1 text-muted transition hover:bg-brand-50 hover:text-brand-800"
          aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        >
          {visible ? (
            <EyeOffIcon className="size-[18px]" />
          ) : (
            <EyeIcon className="size-[18px]" />
          )}
        </button>
      }
    />
  )
}
