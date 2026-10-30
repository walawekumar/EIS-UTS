/**
 * Adapter persistensi lokal — pola siap diganti Supabase/Firebase.
 * Ganti body `load` / `save` / `clear` tanpa mengubah store/UI.
 */
export type LocalRepository<T> = {
  load: () => T
  save: (data: T) => void
  clear: () => void
}

export function createLocalRepository<T>(options: {
  key: string
  seed: () => T
  isValid: (value: unknown) => value is T
}): LocalRepository<T> {
  let cache: T | null = null

  function read(): T {
    try {
      const raw = localStorage.getItem(options.key)
      if (!raw) return options.seed()
      const parsed: unknown = JSON.parse(raw)
      if (!options.isValid(parsed)) return options.seed()
      return parsed
    } catch {
      return options.seed()
    }
  }

  return {
    load() {
      if (!cache) cache = read()
      return cache
    },
    save(data) {
      cache = data
      try {
        localStorage.setItem(options.key, JSON.stringify(data))
      } catch {
        // quota / private mode
      }
    },
    clear() {
      cache = null
      localStorage.removeItem(options.key)
    },
  }
}
