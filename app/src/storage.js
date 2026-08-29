import { makeShareCode } from './share'

const KEY = 'tandem.v1'
const SYNC_CHANNEL = 'tandem.sync.v1'

export const generateRoomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export const uid = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const defaultState = {
  roomCode: generateRoomCode(),
  onboarded: false,
  people: [],
  // Time options are stored as 24h "HH:MM" strings and formatted for display.
  pickupTimes: ['15:00', '15:15', '15:30', '16:00'],
  dropoffTimes: ['07:45', '08:00', '08:15'],
  // Which weekdays (Date.getDay() values) may have rides added. Default Mon to Fri.
  allowedWeekdays: [1, 2, 3, 4, 5],
  // Keyed by "YYYY-MM-DD". Each day can hold several pickups and several drop-offs:
  //   { pickups: [{ id, time: "HH:MM", drivers: [name] }], dropoffs: [ ... ] }
  entries: {},
}

const normalizeSlot = (slot) => ({
  id: slot && slot.id ? slot.id : uid(),
  time: slot && slot.time ? slot.time : '',
  drivers: slot && Array.isArray(slot.drivers) ? slot.drivers : [],
})

// Accepts the current shape or the older single pickup/dropoff shape.
const migrateEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return { pickups: [], dropoffs: [] }
  if (Array.isArray(entry.pickups) || Array.isArray(entry.dropoffs)) {
    return {
      pickups: (entry.pickups || []).map(normalizeSlot),
      dropoffs: (entry.dropoffs || []).map(normalizeSlot),
    }
  }
  const result = { pickups: [], dropoffs: [] }
  if (entry.pickup && (entry.pickup.time || (entry.pickup.drivers || []).length)) {
    result.pickups.push(normalizeSlot(entry.pickup))
  }
  if (entry.dropoff && (entry.dropoff.time || (entry.dropoff.drivers || []).length)) {
    result.dropoffs.push(normalizeSlot(entry.dropoff))
  }
  return result
}

export const normalizeEntries = (raw) => {
  const entries = {}
  for (const [key, entry] of Object.entries(raw || {})) {
    const migrated = migrateEntry(entry)
    if (migrated.pickups.length || migrated.dropoffs.length) entries[key] = migrated
  }
  return entries
}

export const loadState = () => {
  try {
    const raw = localStorage.getItem(KEY)
    const fallback = { ...defaultState, roomCode: generateRoomCode() }
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const merged = { ...fallback, ...parsed, roomCode: parsed?.roomCode || fallback.roomCode }
    merged.entries = normalizeEntries(merged.entries)
    return merged
  } catch {
    return { ...defaultState, roomCode: generateRoomCode() }
  }
}

export const saveState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode, quota). The app still works in memory.
  }
}

export const getSyncRoom = (state) => {
  const code = makeShareCode(state)
  return code ? `tandem.room.${code}` : null
}

export const publishSyncState = (state) => {
  const room = getSyncRoom(state)
  if (!room) return

  const payload = { at: Date.now(), state }
  try {
    localStorage.setItem(room, JSON.stringify(payload))
  } catch {
    // ignore storage quota issues; sync still works in memory for the current tab
  }

  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channel.postMessage({ room, ...payload })
    channel.close()
  } catch {
    // BroadcastChannel may not be available in some browser contexts
  }
}

export const subscribeToSync = (onSync) => {
  if (!('BroadcastChannel' in globalThis) && !('addEventListener' in window)) {
    return () => {}
  }

  const handleStorage = (event) => {
    if (!event.key || !event.key.startsWith('tandem.room.')) return
    try {
      const payload = JSON.parse(event.newValue || 'null')
      if (payload && payload.state) onSync(payload.state)
    } catch {
      // ignore malformed sync payloads
    }
  }

  const handleMessage = (event) => {
    if (!event.data || !event.data.room || !event.data.state) return
    onSync(event.data.state)
  }

  if ('BroadcastChannel' in globalThis) {
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channel.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }

  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}
