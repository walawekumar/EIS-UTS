import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Sync drawer/focus id with `?dok=` query param. */
export function useDokParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dokId, setDokId] = useState<string | null>(
    () => searchParams.get('dok'),
  )

  useEffect(() => {
    const dok = searchParams.get('dok')
    setDokId(dok)
  }, [searchParams])

  function openDok(id: string) {
    setDokId(id)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('dok', id)
      return next
    })
  }

  function clearDok() {
    setDokId(null)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('dok')
      return next
    })
  }

  return { dokId, openDok, clearDok, setDokId }
}
