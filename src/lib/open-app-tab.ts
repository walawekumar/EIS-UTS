const NEXT_PATH_KEY = 'egabah.nextPath'

export function rememberLaunchPath(path: string): void {
  try {
    sessionStorage.setItem(NEXT_PATH_KEY, path)
  } catch {
    // private mode
  }
}

export function consumeLaunchPath(): string | null {
  try {
    const path = sessionStorage.getItem(NEXT_PATH_KEY)
    if (!path) return null
    sessionStorage.removeItem(NEXT_PATH_KEY)
    return path.startsWith('/') ? path : null
  } catch {
    return null
  }
}

/**
 * Open app route in a new tab via a real <a> click (most reliable).
 * Call only from a user gesture (button click).
 */
export function openAppInNewTab(path: string): boolean {
  rememberLaunchPath(path)
  const url = new URL(path, window.location.origin).toString()

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  return true
}
