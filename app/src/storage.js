const KEY = 'tandem.v1'

export const defaultState = {
  onboarded: false,
  people: [],
  // Time options are stored as 24h "HH:MM" strings and formatted for display.
  pickupTimes: ['15:00', '15:15', '15:30', '16:00'],
  dropoffTimes: ['07:45', '08:00', '08:15'],
  // Which weekdays (Date.getDay() values) may have rides added. Default Mon–Fri.
  allowedWeekdays: [1, 2, 3, 4, 5],
  // Keyed by "YYYY-MM-DD":
  //   { pickup: { time: "HH:MM", drivers: [name] }, dropoff: { time, drivers } }
  entries: {},
}

export const loadState = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaultState }
    const parsed = JSON.parse(raw)
    return { ...defaultState, ...parsed }
  } catch {
    return { ...defaultState }
  }
}

export const saveState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode, quota) — the app still works in-memory
  }
}
