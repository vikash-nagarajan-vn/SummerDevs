export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Indexed by Date.getDay() (0 = Sunday)
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Sunday-first order of getDay() values, for calendar headers and pickers
export const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6]

const pad = (n) => String(n).padStart(2, '0')

export const toKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

export const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1)

export const addDays = (date, n) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)

// Returns 6 weeks (rows) of 7 Date objects, Sunday-first, covering the month of `viewDate`.
export const buildMonthGrid = (viewDate) => {
  const first = startOfMonth(viewDate)
  const leading = first.getDay() // days before the 1st, Sunday-first
  const gridStart = addDays(first, -leading)
  const weeks = []
  let cursor = gridStart
  for (let w = 0; w < 6; w += 1) {
    const row = []
    for (let i = 0; i < 7; i += 1) {
      row.push(cursor)
      cursor = addDays(cursor, 1)
    }
    weeks.push(row)
  }
  return weeks
}

export const formatTime = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${pad(m || 0)} ${period}`
}
