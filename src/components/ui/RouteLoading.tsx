type RouteLoadingProps = {
  label?: string
}

/** Brief branded boot screen on the portal tab only. */
export function RouteLoading({
  label = 'Menyiapkan aplikasi…',
}: RouteLoadingProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-surface">
      <span
        className="size-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-800"
        aria-hidden
      />
      <p className="sr-only">{label}</p>
    </div>
  )
}
