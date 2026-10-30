/**
 * Bus sync lokal (multi-tab). Nanti diganti Supabase Realtime / Firestore.
 * UI mendengarkan via `subscribeSync` bila perlu refresh antar tab.
 */

export type SyncEvent = {
  channel: string
  entityId?: string
  at: string
}

const CHANNEL = 'egabah-sync'

export function publishSync(channel: string, entityId?: string) {
  const payload: SyncEvent = {
    channel,
    entityId,
    at: new Date().toISOString(),
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHANNEL)
      bc.postMessage(payload)
      bc.close()
    }
    localStorage.setItem(
      `${CHANNEL}:ping`,
      JSON.stringify({ ...payload, n: Math.random() }),
    )
  } catch {
    // private mode / unsupported
  }
}

export function subscribeSync(handler: (event: SyncEvent) => void): () => void {
  let bc: BroadcastChannel | null = null
  const onMessage = (ev: MessageEvent<SyncEvent>) => {
    if (ev.data?.channel) handler(ev.data)
  }
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== `${CHANNEL}:ping` || !ev.newValue) return
    try {
      const data = JSON.parse(ev.newValue) as SyncEvent
      if (data.channel) handler(data)
    } catch {
      // ignore
    }
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CHANNEL)
      bc.addEventListener('message', onMessage)
    }
  } catch {
    bc = null
  }
  window.addEventListener('storage', onStorage)

  return () => {
    bc?.removeEventListener('message', onMessage)
    bc?.close()
    window.removeEventListener('storage', onStorage)
  }
}
