export function FinanceToast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="motion-rise rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800"
    >
      {message}
    </p>
  )
}
