// Share / join without a backend: the carpool config is encoded into the link
// itself (after #join=). Opening the link, or pasting the code, rebuilds it.

const toBase64Url = (bytes) => {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value) => {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const binary = atob(b64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export const makeShareCode = (state) => {
  if (!state || typeof state !== 'object') return ''
  if (state.roomCode) return String(state.roomCode)
  const payload = {
    v: 1,
    people: state.people,
    pickupTimes: state.pickupTimes,
    dropoffTimes: state.dropoffTimes,
    allowedWeekdays: state.allowedWeekdays,
    entries: state.entries,
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

export const makeShareLink = (state) => {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#join=${makeShareCode(state)}`
}

// Accepts a full invite link, a "...#join=CODE" fragment, or a bare code.
export const parseShareInput = (input) => {
  if (!input) return null
  const trimmed = String(input).trim()
  const afterMarker = trimmed.includes('#join=') ? trimmed.split('#join=')[1] : trimmed
  const code = afterMarker.split(/[?&\s]/)[0]
  if (!code) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(code)))
    if (!data || !Array.isArray(data.people)) return null
    return data
  } catch {
    return null
  }
}
