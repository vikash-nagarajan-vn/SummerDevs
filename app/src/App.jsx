import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import {
  loadState,
  saveState,
  defaultState,
  normalizeEntries,
  uid,
  generateRoomCode,
} from './storage'
import { makeShareCode, makeShareLink, parseShareInput } from './share'
import {
  toKey,
  fromKey,
  isSameDay,
  startOfMonth,
  addMonths,
  buildMonthGrid,
  formatTime,
  MONTHS,
  WEEKDAY_LABELS,
  WEEK_ORDER,
} from './dates'

const LOGO = '/tandem-logo.svg'

const RIDES = [
  { key: 'pickups', label: 'Pickup', glyph: '↑', timesField: 'pickupTimes' },
  { key: 'dropoffs', label: 'Drop-off', glyph: '↓', timesField: 'dropoffTimes' },
]

const emptyEntry = () => ({ pickups: [], dropoffs: [] })
const isEmptyEntry = (e) => e.pickups.length === 0 && e.dropoffs.length === 0
const usefulSlots = (entry) =>
  [
    ...entry.pickups.map((slot) => ({ ...slot, glyph: '↑' })),
    ...entry.dropoffs.map((slot) => ({ ...slot, glyph: '↓' })),
  ].filter((slot) => slot.time || slot.drivers.length)

export default function App() {
  const [state, setState] = useState(loadState)
  const [route, setRoute] = useState(() =>
    state.onboarded ? { name: 'home', params: {} } : { name: 'onboarding', params: { step: 0 } },
  )
  const [pendingJoin, setPendingJoin] = useState(null)
  const socketRef = useRef(null)
  const lastBroadcastRef = useRef('')

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const roomCode = state.roomCode || generateRoomCode()
    if (!state.roomCode) {
      setState((current) => ({ ...current, roomCode }))
      return
    }

    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : `http://${window.location.hostname}:3001`

    if (!socketRef.current) {
      socketRef.current = io(serverUrl, { transports: ['websocket'] })
    }

    const socket = socketRef.current
    const joinHandler = (incoming) => {
      if (!incoming || typeof incoming !== 'object') return
      const incomingCode = makeShareCode(incoming)
      if (!incomingCode || incomingCode !== roomCode) return

      setState((current) => {
        const next = { ...incoming, roomCode: current.roomCode || roomCode }
        const currentValue = JSON.stringify(current)
        const nextValue = JSON.stringify(next)
        if (currentValue === nextValue) return current
        lastBroadcastRef.current = nextValue
        return next
      })
    }

    socket.emit('join-room', roomCode)
    socket.on('state:update', joinHandler)

    return () => {
      socket.off('state:update', joinHandler)
    }
  }, [state.roomCode])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !state.roomCode) return

    const payload = { ...state, roomCode: state.roomCode }
    const payloadValue = JSON.stringify(payload)
    if (payloadValue === lastBroadcastRef.current) return

    lastBroadcastRef.current = payloadValue
    socket.emit('state:update', { code: state.roomCode, state: payload })
  }, [state])

  useEffect(() => {
    const onPop = (event) => {
      if (event.state && event.state.route) setRoute(event.state.route)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const checkHash = () => {
      if (!window.location.hash.startsWith('#join=')) return
      const data = parseShareInput(window.location.hash)
      if (data) {
        setPendingJoin(data)
        setRoute({ name: 'join', params: {} })
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  const clearHash = () => {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    )
  }

  const applyJoin = (data) => {
    const roomCode = data.roomCode || makeShareCode(data) || generateRoomCode()
    setState((current) => ({
      ...current,
      roomCode,
      people: Array.isArray(data.people) ? data.people : current.people,
      pickupTimes: Array.isArray(data.pickupTimes) ? data.pickupTimes : current.pickupTimes,
      dropoffTimes: Array.isArray(data.dropoffTimes) ? data.dropoffTimes : current.dropoffTimes,
      allowedWeekdays: Array.isArray(data.allowedWeekdays)
        ? data.allowedWeekdays
        : current.allowedWeekdays,
      entries: normalizeEntries(data.entries),
      onboarded: true,
    }))
    clearHash()
    setPendingJoin(null)
    navigate('home')
  }

  const cancelJoin = () => {
    clearHash()
    setPendingJoin(null)
    setRoute(
      state.onboarded
        ? { name: 'home', params: {} }
        : { name: 'onboarding', params: { step: 0 } },
    )
  }

  const navigate = (name, params = {}) => {
    const next = { name, params }
    window.history.pushState({ route: next }, '')
    setRoute(next)
    window.scrollTo(0, 0)
  }

  const patch = (fields) => setState((current) => ({ ...current, ...fields }))

  const updateEntry = (key, updater) => {
    setState((current) => {
      const source = current.entries[key] || emptyEntry()
      const draft = {
        pickups: source.pickups.map((slot) => ({ ...slot, drivers: [...slot.drivers] })),
        dropoffs: source.dropoffs.map((slot) => ({ ...slot, drivers: [...slot.drivers] })),
      }
      const next = updater(draft)
      const entries = { ...current.entries }
      if (isEmptyEntry(next)) delete entries[key]
      else entries[key] = next
      return { ...current, entries }
    })
  }

  const addRide = (key, field) =>
    updateEntry(key, (draft) => {
      draft[field] = [...draft[field], { id: uid(), time: '', drivers: [] }]
      return draft
    })

  const removeRide = (key, field, id) =>
    updateEntry(key, (draft) => {
      draft[field] = draft[field].filter((slot) => slot.id !== id)
      return draft
    })

  const setRideTime = (key, field, id, time) =>
    updateEntry(key, (draft) => {
      draft[field] = draft[field].map((slot) => (slot.id === id ? { ...slot, time } : slot))
      return draft
    })

  const toggleDriver = (key, field, id, person) =>
    updateEntry(key, (draft) => {
      draft[field] = draft[field].map((slot) => {
        if (slot.id !== id) return slot
        const has = slot.drivers.includes(person)
        return {
          ...slot,
          drivers: has ? slot.drivers.filter((n) => n !== person) : [...slot.drivers, person],
        }
      })
      return draft
    })

  const pruneDay = (key) =>
    setState((current) => {
      const entry = current.entries[key]
      if (!entry) return current
      const clean = {
        pickups: entry.pickups.filter((slot) => slot.time || slot.drivers.length),
        dropoffs: entry.dropoffs.filter((slot) => slot.time || slot.drivers.length),
      }
      const entries = { ...current.entries }
      if (!clean.pickups.length && !clean.dropoffs.length) delete entries[key]
      else entries[key] = clean
      return { ...current, entries }
    })

  const clearDay = (key) =>
    setState((current) => {
      const entries = { ...current.entries }
      delete entries[key]
      return { ...current, entries }
    })

  const addPerson = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((current) =>
      current.people.includes(trimmed)
        ? current
        : { ...current, people: [...current.people, trimmed] },
    )
  }

  const removePerson = (name) =>
    setState((current) => {
      const strip = (slots) =>
        slots.map((slot) => ({ ...slot, drivers: slot.drivers.filter((d) => d !== name) }))
      const entries = {}
      for (const [key, entry] of Object.entries(current.entries)) {
        entries[key] = { pickups: strip(entry.pickups), dropoffs: strip(entry.dropoffs) }
      }
      return { ...current, people: current.people.filter((p) => p !== name), entries }
    })

  const setTimes = (field, times) => patch({ [field]: times })

  const toggleWeekday = (weekday) =>
    setState((current) => ({
      ...current,
      allowedWeekdays: current.allowedWeekdays.includes(weekday)
        ? current.allowedWeekdays.filter((day) => day !== weekday)
        : [...current.allowedWeekdays, weekday].sort((a, b) => a - b),
    }))

  const shared = {
    state,
    route,
    navigate,
    patch,
    applyJoin,
    addRide,
    removeRide,
    setRideTime,
    toggleDriver,
    pruneDay,
    clearDay,
    addPerson,
    removePerson,
    setTimes,
    toggleWeekday,
  }

  const chromeless = route.name === 'onboarding' || route.name === 'join'

  return (
    <div className="app">
      {!chromeless && <TopNav route={route} navigate={navigate} />}
      <main className="page">
        {route.name === 'onboarding' && <Onboarding {...shared} />}
        {route.name === 'join' && (
          <JoinInvite pendingJoin={pendingJoin} applyJoin={applyJoin} cancelJoin={cancelJoin} />
        )}
        {route.name === 'home' && <Hub {...shared} />}
        {route.name === 'calendar' && <Calendar {...shared} />}
        {route.name === 'date' && <DateDetail {...shared} dateKey={route.params.key} />}
        {route.name === 'people' && <People {...shared} />}
        {route.name === 'settings' && <Settings {...shared} />}
      </main>
    </div>
  )
}

function TopNav({ route, navigate }) {
  const tabs = [
    { name: 'home', label: 'Home' },
    { name: 'calendar', label: 'Calendar' },
    { name: 'people', label: 'People' },
    { name: 'settings', label: 'Settings' },
  ]
  return (
    <header className="topnav">
      <button
        type="button"
        className="brand"
        onClick={() => navigate('home')}
        aria-label="TANDEM home"
      >
        <img src={LOGO} alt="TANDEM" className="brand-mark" />
      </button>
      <nav className="navlinks">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            className={route.name === tab.name ? 'navlink active' : 'navlink'}
            onClick={() => navigate(tab.name)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

function TimeEditor({ label, times, onChange }) {
  const update = (index, value) =>
    onChange(times.map((time, i) => (i === index ? value : time)))
  const remove = (index) => onChange(times.filter((_, i) => i !== index))
  const add = () => onChange([...times, '15:00'])

  return (
    <div className="stack">
      <div className="row-between">
        <h3>{label}</h3>
        <button type="button" className="btn ghost sm" onClick={add}>
          + Add time
        </button>
      </div>
      {times.length === 0 ? (
        <p className="muted">No times yet. Add one so it shows up as a quick option.</p>
      ) : (
        <div className="timegrid">
          {times.map((time, index) => (
            <div key={index} className="timerow">
              <input
                type="time"
                value={time}
                onChange={(event) => update(index, event.target.value)}
              />
              <button
                type="button"
                className="iconbtn"
                onClick={() => remove(index)}
                aria-label={`Remove ${formatTime(time)}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekdayPicker({ allowed, onToggle }) {
  return (
    <div className="choice-row">
      {WEEK_ORDER.map((weekday) => (
        <button
          key={weekday}
          type="button"
          className={allowed.includes(weekday) ? 'toggle on' : 'toggle'}
          onClick={() => onToggle(weekday)}
        >
          {WEEKDAY_LABELS[weekday]}
        </button>
      ))}
    </div>
  )
}

function PeopleField({ people, onAdd, onRemove }) {
  const [name, setName] = useState('')
  const submit = (event) => {
    event.preventDefault()
    onAdd(name)
    setName('')
  }
  return (
    <div className="stack">
      <form className="addrow" onSubmit={submit}>
        <input
          placeholder="Add a name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {people.length === 0 ? (
        <p className="muted">No one added yet.</p>
      ) : (
        <ul className="chips">
          {people.map((person) => (
            <li key={person} className="chip">
              <span>{person}</span>
              <button
                type="button"
                className="iconbtn"
                onClick={() => onRemove(person)}
                aria-label={`Remove ${person}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Onboarding({ state, route, navigate, patch, addPerson, removePerson, setTimes, toggleWeekday }) {
  const step = route.params.step ?? 0
  const labels = ['People', 'Pickup times', 'Drop-off times', 'Schedule days']
  const go = (index) => navigate('onboarding', { step: index })
  const finish = () => {
    patch({ onboarded: true })
    navigate('home')
  }

  return (
    <div className="onboard">
      <div className="onboard-head">
        <img src={LOGO} alt="TANDEM" className="onboard-mark" />
        <h1>Set up your carpool</h1>
        <p className="muted">Everything here can be changed later in Settings.</p>
        <ol className="steps">
          {labels.map((item, index) => (
            <li key={item} className={index === step ? 'active' : index < step ? 'done' : ''}>
              {item}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <section className="card stack">
          <h2>Who is in the carpool?</h2>
          <p className="muted">Add the people who might drive. You can add more anytime.</p>
          <PeopleField people={state.people} onAdd={addPerson} onRemove={removePerson} />
          <div className="row-end">
            <button
              type="button"
              className="btn"
              disabled={state.people.length === 0}
              onClick={() => go(1)}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="card stack">
          <h2>When are pickups?</h2>
          <p className="muted">These become one tap options when you schedule a day.</p>
          <TimeEditor
            label="Pickup times"
            times={state.pickupTimes}
            onChange={(times) => setTimes('pickupTimes', times)}
          />
          <div className="row-between">
            <button type="button" className="btn ghost" onClick={() => go(0)}>
              Back
            </button>
            <button type="button" className="btn" onClick={() => go(2)}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card stack">
          <h2>When are drop-offs?</h2>
          <p className="muted">Same idea. Quick options for the drop-off run.</p>
          <TimeEditor
            label="Drop-off times"
            times={state.dropoffTimes}
            onChange={(times) => setTimes('dropoffTimes', times)}
          />
          <div className="row-between">
            <button type="button" className="btn ghost" onClick={() => go(1)}>
              Back
            </button>
            <button type="button" className="btn" onClick={() => go(3)}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card stack">
          <h2>Which days can be scheduled?</h2>
          <p className="muted">
            Only these weekdays can have pickups or drop-offs added on the calendar. No weekends
            unless you choose them.
          </p>
          <WeekdayPicker allowed={state.allowedWeekdays} onToggle={toggleWeekday} />
          <div className="row-between">
            <button type="button" className="btn ghost" onClick={() => go(2)}>
              Back
            </button>
            <button type="button" className="btn" onClick={finish}>
              Finish setup
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function Hub({ state, navigate, applyJoin }) {
  const upcoming = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Object.entries(state.entries)
      .map(([key, entry]) => ({ key, entry, date: fromKey(key) }))
      .filter((item) => item.date >= startOfToday && usefulSlots(item.entry).length > 0)
      .sort((a, b) => a.date - b.date)
      .slice(0, 6)
  }, [state.entries])

  const scheduledDays = WEEK_ORDER.filter((d) => state.allowedWeekdays.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ')

  return (
    <div className="stack lg">
      <div className="hub-hero">
        <h1>Your carpool</h1>
        <p className="muted">
          {state.people.length
            ? `${state.people.length} ${state.people.length === 1 ? 'driver' : 'drivers'} ready to schedule.`
            : 'Add drivers and times to get started.'}
        </p>
      </div>

      <div className="tiles">
        <button
          type="button"
          className="tile tile-accent"
          onClick={() => navigate('calendar')}
        >
          <span className="tile-kicker">Plan</span>
          <span className="tile-title">Open the calendar</span>
          <span className="tile-sub">
            Pick a day, add pickups and drop-offs, choose who drives.
          </span>
        </button>
        <button type="button" className="tile" onClick={() => navigate('people')}>
          <span className="tile-kicker">People</span>
          <span className="tile-title">
            {state.people.length ? state.people.join(', ') : 'No drivers yet'}
          </span>
          <span className="tile-sub">Add or remove carpool drivers.</span>
        </button>
        <button type="button" className="tile" onClick={() => navigate('settings')}>
          <span className="tile-kicker">Settings</span>
          <span className="tile-title">{scheduledDays || 'No days turned on'}</span>
          <span className="tile-sub">Edit pickup and drop-off times and schedulable days.</span>
        </button>
      </div>

      <section className="card stack">
        <h2>Upcoming rides</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled yet. Open the calendar to add a ride.</p>
        ) : (
          <ul className="upcoming">
            {upcoming.map(({ key, entry, date }) => (
              <li key={key}>
                <button
                  type="button"
                  className="upcoming-row"
                  onClick={() => navigate('date', { key })}
                >
                  <span className="upcoming-date">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="upcoming-rides">
                    {usefulSlots(entry).map((slot) => (
                      <span
                        key={slot.id}
                        className={slot.drivers.length ? 'chip-slot covered' : 'chip-slot'}
                      >
                        {slot.glyph} {slot.time ? formatTime(slot.time) : 'needs time'}
                        {slot.drivers.length ? ` · ${slot.drivers.join(', ')}` : ''}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ShareCard state={state} applyJoin={applyJoin} />
    </div>
  )
}

function ShareCard({ state, applyJoin }) {
  const link = useMemo(() => makeShareLink(state), [state])
  const [copied, setCopied] = useState('')
  const [joinValue, setJoinValue] = useState('')
  const [error, setError] = useState('')

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard blocked; the value is selectable in the field instead
    }
    setCopied(tag)
    window.setTimeout(() => setCopied(''), 1500)
  }

  const submitJoin = (event) => {
    event.preventDefault()
    const data = parseShareInput(joinValue)
    if (!data) {
      setError('That link or code did not work. Check it and try again.')
      return
    }
    if (
      !window.confirm(
        'Joining replaces the people, times, and schedule on this device. Continue?',
      )
    ) {
      return
    }
    setError('')
    setJoinValue('')
    applyJoin(data)
  }

  return (
    <section className="card stack">
      <h2>Share this carpool</h2>
      <p className="muted">Share the join code with anyone who should be added to this carpool.</p>
      <div className="share-row">
        <input
          className="share-link"
          readOnly
          value={makeShareCode(state)}
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          className="btn sm"
          onClick={() => copy(makeShareCode(state), 'code')}
        >
          {copied === 'code' ? 'Copied' : 'Copy join code'}
        </button>
      </div>

      <hr className="divider" />

      <h3>Join a carpool</h3>
      <p className="muted">Paste a join code someone shared with you.</p>
      <form className="addrow" onSubmit={submitJoin}>
        <input
          placeholder="Paste join code"
          value={joinValue}
          onChange={(event) => setJoinValue(event.target.value)}
        />
        <button type="submit" className="btn">
          Join
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </section>
  )
}

function JoinInvite({ pendingJoin, applyJoin, cancelJoin }) {
  const data = pendingJoin || {}
  const times = (data.pickupTimes?.length || 0) + (data.dropoffTimes?.length || 0)
  const days = Object.keys(data.entries || {}).length

  return (
    <div className="onboard">
      <div className="onboard-head">
        <img src={LOGO} alt="TANDEM" className="onboard-mark" />
        <h1>Join this carpool?</h1>
        <p className="muted">Someone shared their TANDEM carpool with you.</p>
      </div>
      <section className="card stack">
        <div className="join-summary">
          <div>
            <strong>{data.people?.length || 0}</strong>
            <span>drivers</span>
          </div>
          <div>
            <strong>{times}</strong>
            <span>saved times</span>
          </div>
          <div>
            <strong>{days}</strong>
            <span>scheduled days</span>
          </div>
        </div>
        {data.people?.length > 0 && <p className="muted">Drivers: {data.people.join(', ')}</p>}
        <p className="muted">Joining replaces the carpool currently on this device.</p>
        <div className="row-between">
          <button type="button" className="btn ghost" onClick={cancelJoin}>
            Not now
          </button>
          <button type="button" className="btn" onClick={() => applyJoin(data)}>
            Join carpool
          </button>
        </div>
      </section>
    </div>
  )
}

function Calendar({ state, navigate }) {
  const [view, setView] = useState(() => startOfMonth(new Date()))
  const today = new Date()
  const weeks = useMemo(() => buildMonthGrid(view), [view])

  return (
    <div className="stack lg">
      <div className="cal-head">
        <div>
          <h1>
            {MONTHS[view.getMonth()]} {view.getFullYear()}
          </h1>
          <p className="muted">
            {state.people.length
              ? `Drivers: ${state.people.join(', ')}`
              : 'No drivers yet. Add people to start scheduling.'}
          </p>
        </div>
        <div className="cal-nav">
          <button
            type="button"
            className="iconbtn lg"
            onClick={() => setView(addMonths(view, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setView(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className="iconbtn lg"
            onClick={() => setView(addMonths(view, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar">
        <div className="cal-grid cal-weekdays">
          {WEEK_ORDER.map((weekday) => (
            <div key={weekday} className="cal-wd">
              {WEEKDAY_LABELS[weekday]}
            </div>
          ))}
        </div>
        {weeks.map((week, index) => (
          <div key={index} className="cal-grid">
            {week.map((day) => {
              const key = toKey(day)
              const inMonth = day.getMonth() === view.getMonth()
              const allowed = state.allowedWeekdays.includes(day.getDay())
              const entry = state.entries[key]
              const classes = ['cal-day']
              if (!inMonth) classes.push('outside')
              if (!allowed) classes.push('closed')
              if (isSameDay(day, today)) classes.push('today')

              return (
                <button
                  key={key}
                  type="button"
                  className={classes.join(' ')}
                  disabled={!allowed}
                  onClick={() => navigate('date', { key })}
                >
                  <span className="cal-num">{day.getDate()}</span>
                  {entry && (
                    <span className="cal-slots">
                      {usefulSlots(entry).map((slot) => (
                        <span
                          key={slot.id}
                          className={slot.drivers.length ? 'cal-slot covered' : 'cal-slot'}
                        >
                          {slot.glyph} {slot.time ? formatTime(slot.time) : 'needs time'}
                          {slot.drivers.length ? ` · ${slot.drivers.join(', ')}` : ''}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <p className="legend">
        <span className="dot" /> covered &nbsp;·&nbsp; ↑ pickup &nbsp;·&nbsp; ↓ drop-off
        &nbsp;·&nbsp; tap any day to edit
      </p>
    </div>
  )
}

function DateDetail({
  state,
  navigate,
  dateKey,
  addRide,
  removeRide,
  setRideTime,
  toggleDriver,
  pruneDay,
  clearDay,
  toggleWeekday,
}) {
  const date = fromKey(dateKey)
  const allowed = state.allowedWeekdays.includes(date.getDay())
  const entry = state.entries[dateKey] || emptyEntry()
  const heading = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const hasAnything = !isEmptyEntry(entry)

  const save = () => {
    pruneDay(dateKey)
    navigate('calendar')
  }

  return (
    <div className="stack lg">
      <button type="button" className="btn ghost sm back" onClick={save}>
        ‹ Calendar
      </button>
      <h1>{heading}</h1>

      {!allowed && (
        <div className="notice">
          <span>This weekday is not part of your schedule yet.</span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => toggleWeekday(date.getDay())}
          >
            Add {date.toLocaleDateString('en-US', { weekday: 'long' })}s
          </button>
        </div>
      )}

      {state.people.length === 0 ? (
        <div className="card stack">
          <p className="muted">Add people before you can assign drivers.</p>
          <div className="row-end">
            <button type="button" className="btn" onClick={() => navigate('people')}>
              Go to People
            </button>
          </div>
        </div>
      ) : (
        RIDES.map((ride) => {
          const slots = entry[ride.key]
          const options = state[ride.timesField]
          return (
            <section key={ride.key} className="card stack">
              <div className="row-between">
                <h2>
                  {ride.glyph} {ride.label}
                  {slots.length > 1 ? `s (${slots.length})` : ''}
                </h2>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => addRide(dateKey, ride.key)}
                >
                  + Add {ride.label.toLowerCase()}
                </button>
              </div>

              {slots.length === 0 && (
                <p className="muted">
                  No {ride.label.toLowerCase()} yet. Add one to set a time and pick drivers.
                </p>
              )}

              {slots.map((slot, index) => {
                const customValue = options.includes(slot.time) ? '' : slot.time
                return (
                  <div key={slot.id} className="ride-slot stack sm">
                    <div className="row-between">
                      <span className="field-label">
                        {ride.label} {index + 1}
                      </span>
                      <button
                        type="button"
                        className="iconbtn"
                        onClick={() => removeRide(dateKey, ride.key, slot.id)}
                        aria-label={`Remove ${ride.label.toLowerCase()} ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>

                    <span className="field-label">Time</span>
                    <div className="choice-row">
                      {options.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={slot.time === time ? 'toggle on' : 'toggle'}
                          onClick={() =>
                            setRideTime(
                              dateKey,
                              ride.key,
                              slot.id,
                              slot.time === time ? '' : time,
                            )
                          }
                        >
                          {formatTime(time)}
                        </button>
                      ))}
                      <label className="custom-time">
                        <span>Custom</span>
                        <input
                          type="time"
                          value={customValue}
                          onChange={(event) =>
                            setRideTime(dateKey, ride.key, slot.id, event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <span className="field-label">Who is driving</span>
                    <div className="choice-row">
                      {state.people.map((person) => (
                        <button
                          key={person}
                          type="button"
                          className={slot.drivers.includes(person) ? 'toggle on' : 'toggle'}
                          onClick={() => toggleDriver(dateKey, ride.key, slot.id, person)}
                        >
                          {person}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })
      )}

      <div className="row-between">
        <button
          type="button"
          className="btn ghost sm"
          disabled={!hasAnything}
          onClick={() => clearDay(dateKey)}
        >
          Clear day
        </button>
        <button type="button" className="btn" onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}

function People({ state, addPerson, removePerson }) {
  return (
    <div className="stack lg">
      <h1>People</h1>
      <p className="muted">
        These are the drivers TANDEM offers when you open a day on the calendar.
      </p>
      <section className="card">
        <PeopleField people={state.people} onAdd={addPerson} onRemove={removePerson} />
      </section>
    </div>
  )
}

function Settings({ state, navigate, patch, setTimes, toggleWeekday }) {
  const resetAll = () => {
    if (
      window.confirm('Reset all TANDEM data? People, times, and scheduled days will be cleared.')
    ) {
      patch({ ...defaultState, onboarded: true })
    }
  }

  return (
    <div className="stack lg">
      <h1>Settings</h1>
      <p className="muted">Changes here take effect on the calendar right away.</p>

      <section className="card">
        <TimeEditor
          label="Pickup times"
          times={state.pickupTimes}
          onChange={(times) => setTimes('pickupTimes', times)}
        />
      </section>

      <section className="card">
        <TimeEditor
          label="Drop-off times"
          times={state.dropoffTimes}
          onChange={(times) => setTimes('dropoffTimes', times)}
        />
      </section>

      <section className="card stack">
        <h3>Schedulable days</h3>
        <p className="muted">
          Only these weekdays can have rides added. Turn a day off and it becomes read only on the
          calendar.
        </p>
        <WeekdayPicker allowed={state.allowedWeekdays} onToggle={toggleWeekday} />
      </section>

      <section className="card stack">
        <h3>People</h3>
        <p className="muted">Add or remove carpool drivers on the People page.</p>
        <div className="row-end">
          <button type="button" className="btn ghost sm" onClick={() => navigate('people')}>
            Open People
          </button>
        </div>
      </section>

      <section className="card stack">
        <h3>Reset</h3>
        <p className="muted">Start over with an empty carpool.</p>
        <div className="row-end">
          <button type="button" className="btn danger sm" onClick={resetAll}>
            Reset everything
          </button>
        </div>
      </section>
    </div>
  )
}
