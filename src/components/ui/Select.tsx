import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons'

export type SelectOption<T extends string> = {
  value: T
  label: string
  description?: string
}

type SelectProps<T extends string> = {
  id?: string
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  requiredMark?: boolean
  leading?: ReactNode
  placeholder?: string
  /** Sembunyikan label visual (tetap ada untuk a11y) — baris kontrol padat */
  hideLabel?: boolean
  className?: string
}

type MenuPos = {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

export function Select<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  requiredMark = false,
  leading,
  placeholder = 'Pilih opsi',
  hideLabel = false,
  className,
}: SelectProps<T>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const listId = `${fieldId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((opt) => opt.value === value),
    ),
  )

  const selected = options.find((opt) => opt.value === value)

  function computePosition(contentHeight?: number): MenuPos | null {
    const trigger = triggerRef.current
    if (!trigger) return null

    const rect = trigger.getBoundingClientRect()
    const gap = 8
    const pad = 12
    const spaceBelow = window.innerHeight - rect.bottom - pad - gap
    const spaceAbove = rect.top - pad - gap
    const estimated = contentHeight ?? options.length * 52 + 8
    const nearBottom = rect.bottom > window.innerHeight * 0.5

    const openUp =
      nearBottom
        ? spaceAbove >= Math.min(estimated, spaceBelow) || spaceAbove >= 160
        : estimated > spaceBelow && spaceAbove > spaceBelow

    if (openUp) {
      const maxHeight = Math.min(estimated, Math.max(0, spaceAbove))
      return {
        left: rect.left,
        width: rect.width,
        maxHeight,
        bottom: window.innerHeight - rect.top + gap,
      }
    }

    const maxHeight = Math.min(estimated, Math.max(0, spaceBelow))
    return {
      left: rect.left,
      width: rect.width,
      maxHeight,
      top: rect.bottom + gap,
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }

    // Pass 1: posisi awal
    setPos(computePosition())

    // Pass 2: ukur tinggi aktual lalu clamp
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      if (!list) return
      const next = computePosition(list.scrollHeight)
      if (next) setPos(next)

      const selectedEl = list.querySelector('[aria-selected="true"]')
      if (selectedEl instanceof HTMLElement) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [open, options.length])

  useEffect(() => {
    if (!open) return

    function onReposition() {
      const list = listRef.current
      const next = computePosition(list?.scrollHeight)
      if (next) setPos(next)
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const index = options.findIndex((opt) => opt.value === value)
    setActiveIndex(index >= 0 ? index : 0)
    queueMicrotask(() => listRef.current?.focus())
  }, [open, options, value])

  function choose(next: T) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const opt = options[activeIndex]
      if (opt) choose(opt.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${fieldId}-label`}
            onKeyDown={onListKeyDown}
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              top: pos.top,
              bottom: pos.bottom,
              zIndex: 100,
            }}
            className="scrollbar-none overflow-y-auto overscroll-contain rounded-xl border border-line bg-panel py-1 shadow-[0_16px_40px_rgba(20,32,25,0.16)] outline-none"
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === value
              const isActive = index === activeIndex
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(opt.value)}
                  className={[
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left transition',
                    isActive ? 'bg-brand-50' : 'bg-panel',
                  ].join(' ')}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-brand-700">
                    {isSelected ? <CheckIcon className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{opt.label}</span>
                    {opt.description ? (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {opt.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={['relative', className].filter(Boolean).join(' ')}>
      <span
        id={`${fieldId}-label`}
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 block text-[13px] font-medium text-ink'
        }
      >
        {label}
        {requiredMark ? <span className="ml-0.5 text-brand-600">*</span> : null}
      </span>

      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${fieldId}-label`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={[
          'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-panel px-3 text-left transition',
          open
            ? 'border-brand-600 ring-2 ring-brand-100'
            : 'border-line hover:border-brand-300',
        ].join(' ')}
      >
        {leading ? (
          <span className="shrink-0 text-muted/80 [&_svg]:size-[18px]">{leading}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          className={[
            'size-4 shrink-0 text-muted transition',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {menu}
    </div>
  )
}
