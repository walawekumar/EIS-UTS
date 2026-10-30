import { useEffect, useState } from 'react'
import {
  SETTINGS_EVENT,
  getPageSize,
} from '@/features/settings/app-settings'

export function usePageSize(): number {
  const [size, setSize] = useState(getPageSize)
  useEffect(() => {
    const sync = () => setSize(getPageSize())
    window.addEventListener(SETTINGS_EVENT, sync)
    return () => window.removeEventListener(SETTINGS_EVENT, sync)
  }, [])
  return size
}
