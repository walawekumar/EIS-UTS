type Listener = (message: string | null) => void

let lastError: string | null = null
const listeners = new Set<Listener>()

export function getCloudPersistError(): string | null {
  return lastError
}

export function setCloudPersistError(message: string | null): void {
  lastError = message
  for (const listener of listeners) listener(message)
}

export function clearCloudPersistError(): void {
  setCloudPersistError(null)
}

export function subscribeCloudPersistError(listener: Listener): () => void {
  listeners.add(listener)
  listener(lastError)
  return () => {
    listeners.delete(listener)
  }
}
