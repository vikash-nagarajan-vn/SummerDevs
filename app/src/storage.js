const KEY = 'tandem.v1'

export const uid = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const defaultState = {
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
    if (!raw) return { ...defaultState }
    const merged = { ...defaultState, ...JSON.parse(raw) }
    merged.entries = normalizeEntries(merged.entries)
    return merged
  } catch {
    return { ...defaultState }
  }
}

export const saveState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode, quota). The app still works in memory.
  }
}
