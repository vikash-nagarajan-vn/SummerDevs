import { useMemo, useState } from 'react'
import './App.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PICKUP_OPTIONS = ['3:00 PM', '3:15 PM', '3:30 PM', '4:00 PM']
const DROPOFF_OPTIONS = ['3:30 PM', '3:45 PM', '4:15 PM', '4:30 PM']

const buildDefaultAvailability = () => ({
  Mon: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:45 PM'] } },
  Tue: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM', '3:30 PM'] }, dropoff: { selected: true, certainty: 'maybe', times: ['3:45 PM'] } },
  Wed: { pickup: { selected: true, certainty: 'maybe', times: ['4:00 PM'] }, dropoff: { selected: false, certainty: 'sure', times: [] } },
  Thu: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: true, certainty: 'sure', times: ['4:15 PM'] } },
  Fri: { pickup: { selected: true, certainty: 'sure', times: ['3:30 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:30 PM'] } },
  Sat: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: false, certainty: 'sure', times: [] } },
  Sun: { pickup: { selected: true, certainty: 'maybe', times: ['3:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['4:30 PM'] } },
})

const defaultParticipants = [
  { name: 'Alex', availability: buildDefaultAvailability() },
  { name: 'Sam', availability: { ...buildDefaultAvailability(), Mon: { pickup: { selected: true, certainty: 'maybe', times: ['3:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:45 PM'] } }, Tue: { pickup: { selected: true, certainty: 'sure', times: ['3:30 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:45 PM'] } }, Wed: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM'] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Thu: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: true, certainty: 'sure', times: ['4:15 PM'] } }, Fri: { pickup: { selected: true, certainty: 'maybe', times: ['3:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:30 PM'] } }, Sat: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Sun: { pickup: { selected: true, certainty: 'sure', times: ['3:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['4:30 PM'] } } } },
  { name: 'Jordan', availability: { ...buildDefaultAvailability(), Mon: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM', '3:30 PM'] }, dropoff: { selected: true, certainty: 'maybe', times: ['3:45 PM'] } }, Tue: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM'] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Wed: { pickup: { selected: true, certainty: 'sure', times: ['3:30 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['4:15 PM'] } }, Thu: { pickup: { selected: true, certainty: 'maybe', times: ['4:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['4:15 PM'] } }, Fri: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: true, certainty: 'sure', times: ['3:30 PM'] } }, Sat: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Sun: { pickup: { selected: true, certainty: 'sure', times: ['3:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['4:15 PM'] } } } },
  { name: 'Chris', availability: { ...buildDefaultAvailability(), Mon: { pickup: { selected: true, certainty: 'sure', times: ['3:00 PM'] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Tue: { pickup: { selected: true, certainty: 'maybe', times: ['4:00 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:45 PM'] } }, Wed: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: true, certainty: 'sure', times: ['3:45 PM'] } }, Thu: { pickup: { selected: true, certainty: 'sure', times: ['3:15 PM'] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Fri: { pickup: { selected: true, certainty: 'maybe', times: ['3:30 PM'] }, dropoff: { selected: true, certainty: 'sure', times: ['3:30 PM'] } }, Sat: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: false, certainty: 'sure', times: [] } }, Sun: { pickup: { selected: false, certainty: 'sure', times: [] }, dropoff: { selected: true, certainty: 'maybe', times: ['4:30 PM'] } } } },
]

const starterSchedule = {
  name: 'School Carpool',
  creator: 'Alex',
  code: 'X7K29A',
  days: DAYS,
  pickupTimes: PICKUP_OPTIONS,
  dropoffTimes: DROPOFF_OPTIONS,
  participants: defaultParticipants,
}

const formatWeekRange = (date) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  start.setDate(start.getDate() + diff)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const monthDay = (value) => value.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  return `${monthDay(start)}–${monthDay(end)}`
}

const getWeekStart = (baseDate = new Date()) => {
  const date = new Date(baseDate)
  const diff = (date.getDay() + 6) % 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - diff)
  return date
}

const sameDayName = (date) => {
  const dayIndex = (date.getDay() + 6) % 7
  return DAYS[dayIndex]
}

function App() {
  const [screen, setScreen] = useState('home')
  const [activeTab, setActiveTab] = useState('schedule')
  const [wizardMode, setWizardMode] = useState(null)
  const [joinForm, setJoinForm] = useState({ code: 'X7K29A', name: 'Jordan' })
  const [schedule, setSchedule] = useState(starterSchedule)
  const [selectedPerson, setSelectedPerson] = useState('Alex')
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [generatedSchedule, setGeneratedSchedule] = useState([
    { day: 'Mon', type: 'pickup', person: 'Alex', certainty: 'sure' },
    { day: 'Mon', type: 'dropoff', person: 'Sam', certainty: 'sure' },
    { day: 'Tue', type: 'pickup', person: 'Jordan', certainty: 'sure' },
    { day: 'Tue', type: 'dropoff', person: 'Alex', certainty: 'sure' },
    { day: 'Wed', type: 'pickup', person: 'Sam', certainty: 'sure' },
    { day: 'Wed', type: 'dropoff', person: 'Jordan', certainty: 'sure' },
  ])

  const selectedUser = useMemo(
    () => schedule.participants.find((person) => person.name === selectedPerson) ?? schedule.participants[0],
    [schedule.participants, selectedPerson],
  )

  const weekDays = useMemo(
    () => DAYS.map((day, index) => {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + index)
      return { name: day, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), date }
    }),
    [weekStart],
  )

  const todayAssignments = useMemo(() => {
    const todayName = sameDayName(new Date())
    return generatedSchedule.filter((entry) => entry.day === todayName)
  }, [generatedSchedule])

  const participantBalance = useMemo(() => {
    const total = schedule.participants.map((person) => ({
      name: person.name,
      rides: generatedSchedule.filter((entry) => entry.person === person.name).length,
    }))
    return total.sort((a, b) => b.rides - a.rides || a.name.localeCompare(b.name))
  }, [generatedSchedule, schedule.participants])

  const createSchedule = () => {
    setScreen('schedule')
    setActiveTab('schedule')
    setWizardMode(null)
  }

  const joinSchedule = () => {
    setScreen('schedule')
    setActiveTab('schedule')
    setWizardMode(null)
  }

  const setAvailability = (day, rideType, next) => {
    setSchedule((current) => ({
      ...current,
      participants: current.participants.map((person) => {
        if (person.name !== selectedUser.name) return person
        const previous = person.availability?.[day]?.[rideType] ?? { selected: false, certainty: 'sure', times: [] }
        const safeTimes = next?.selected ? (next.times?.length ? next.times : previous.times) : []

        return {
          ...person,
          availability: {
            ...person.availability,
            [day]: {
              ...person.availability[day],
              [rideType]: {
                selected: next?.selected ?? previous.selected,
                certainty: next?.certainty ?? previous.certainty ?? 'sure',
                times: safeTimes,
              },
            },
          },
        }
      }),
    }))
  }

  const toggleRideSelection = (day, rideType) => {
    const current = selectedUser.availability?.[day]?.[rideType] ?? { selected: false, certainty: 'sure', times: [] }
    const nextSelected = !current.selected
    setAvailability(day, rideType, {
      selected: nextSelected,
      certainty: current.certainty || 'sure',
      times: nextSelected ? current.times.length ? current.times : [schedule.pickupTimes[0]] : [],
    })
  }

  const setRideCertainty = (day, rideType, certainty) => {
    const current = selectedUser.availability?.[day]?.[rideType] ?? { selected: false, certainty: 'sure', times: [] }
    setAvailability(day, rideType, {
      selected: current.selected,
      certainty,
      times: current.times,
    })
  }

  const toggleTimeSelection = (day, rideType, time) => {
    const current = selectedUser.availability?.[day]?.[rideType] ?? { selected: true, certainty: 'sure', times: [] }
    const times = current.times.includes(time)
      ? current.times.filter((entry) => entry !== time)
      : [...current.times, time]

    setAvailability(day, rideType, {
      selected: true,
      certainty: current.certainty || 'sure',
      times,
    })
  }

  const removeAvailability = (day, rideType) => {
    setAvailability(day, rideType, {
      selected: false,
      certainty: 'sure',
      times: [],
    })
  }

  const generateFairSchedule = () => {
    const riderCounts = Object.fromEntries(schedule.participants.map((person) => [person.name, 0]))
    const assignments = []

    DAYS.forEach((day) => {
      ['pickup', 'dropoff'].forEach((rideType) => {
        const available = schedule.participants
          .filter((person) => {
            const slot = person.availability?.[day]?.[rideType]
            return slot?.selected && slot.times?.length > 0
          })
          .map((person) => {
            const slot = person.availability[day][rideType]
            const score = (slot.certainty === 'sure' ? 110 : 70) - riderCounts[person.name] * 18
            return { person: person.name, certainty: slot.certainty, score }
          })
          .sort((a, b) => b.score - a.score || a.person.localeCompare(b.person))

        if (available.length > 0) {
          const chosen = available[0]
          assignments.push({ day, type: rideType, person: chosen.person, certainty: chosen.certainty })
          riderCounts[chosen.person] += 1
        }
      })
    })

    setGeneratedSchedule(assignments)
  }

  return (
    <div className="app-shell">
      {screen === 'home' ? (
        <div className="landing-page">
          <header className="landing-header">
            <div className="brand">PULLUP</div>
          </header>

          <main className="hero-panel">
            <p className="eyebrow">Your ride. Your route. Your community.</p>
            <h1>PULLUP</h1>
            <p className="subhead">Coordinate school carpools, see who&apos;s available, and automatically create a fair schedule.</p>

            <div className="cta-row">
              <button type="button" className="primary-button" onClick={() => setWizardMode('create')}>
                Create a Schedule
              </button>
              <button type="button" className="secondary-button" onClick={() => setWizardMode('join')}>
                Join a Schedule
              </button>
            </div>
          </main>

          {wizardMode && (
            <section className="wizard-panel">
              {wizardMode === 'create' ? (
                <>
                  <h2>Create a schedule</h2>
                  <label>
                    Schedule Name
                    <input defaultValue={schedule.name} onChange={(event) => setSchedule((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    Creator Name
                    <input defaultValue={schedule.creator} onChange={(event) => setSchedule((current) => ({ ...current, creator: event.target.value }))} />
                  </label>
                  <div className="days-grid">
                    {DAYS.map((day) => (
                      <label key={day} className="day-pill">
                        <input type="checkbox" defaultChecked />
                        {day}
                      </label>
                    ))}
                  </div>
                  <button type="button" className="primary-button" onClick={createSchedule}>
                    Create Schedule
                  </button>
                </>
              ) : (
                <>
                  <h2>You&apos;ve been invited to join</h2>
                  <p className="invite-name">{schedule.name}</p>
                  <label>
                    Name
                    <input value={joinForm.name} onChange={(event) => setJoinForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <button type="button" className="primary-button" onClick={joinSchedule}>
                    Join Schedule
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="dashboard-shell">
          <aside className="sidebar">
            <div className="brand">PULLUP</div>
            <nav className="nav">
              {['schedule', 'people', 'share', 'settings'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </aside>

          <main className="main-panel">
            {activeTab === 'schedule' && (
              <>
                <div className="topbar">
                  <div>
                    <div className="section-kicker">School Carpool</div>
                    <div className="title-group">
                      <button type="button" className="ghost-button" onClick={() => setWeekStart((current) => new Date(current.setDate(current.getDate() - 7)))}>
                        {'< Previous Week'}
                      </button>
                      <h2>{formatWeekRange(weekStart)}</h2>
                      <button type="button" className="ghost-button" onClick={() => setWeekStart((current) => new Date(current.setDate(current.getDate() + 7)))}>
                        {'Next Week >'}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="primary-button" onClick={generateFairSchedule}>
                    Generate Schedule
                  </button>
                </div>

                <section className="mini-summary">
                  <div className="mini-block">
                    <div className="label">Today</div>
                    {todayAssignments.length ? (
                      <div className="today-row">
                        {todayAssignments.map((ride) => (
                          <span key={`${ride.day}-${ride.type}`}>
                            {ride.type === 'pickup' ? 'Pickup' : 'Drop-off'}: {ride.person} · {ride.certainty === 'sure' ? 'For Sure' : 'Maybe'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="today-empty">No rides scheduled today.</div>
                    )}
                  </div>
                </section>

                <section className="calendar-card">
                  <div className="calendar-head">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <div key={day} className="day-header">{day}</div>
                    ))}
                  </div>
                  <div className="calendar-row">
                    {DAYS.map((day) => {
                      const person = selectedUser
                      const pickup = person.availability?.[day]?.pickup
                      const drop = person.availability?.[day]?.dropoff
                      return (
                        <div key={day} className="day-box">
                          <div className="day-tag">{day}</div>
                          <div className="availability-toggle">
                            <span>Pickup</span>
                            <input type="checkbox" checked={pickup?.selected ?? false} onChange={() => toggleRideSelection(day, 'pickup')} />
                          </div>
                          <div className="availability-toggle">
                            <span>Drop-off</span>
                            <input type="checkbox" checked={drop?.selected ?? false} onChange={() => toggleRideSelection(day, 'dropoff')} />
                          </div>
                          {pickup?.selected && (
                            <div className="ride-config">
                              <div className="certainty-row">
                                <button type="button" className={pickup.certainty === 'sure' ? 'chip active green' : 'chip'} onClick={() => setRideCertainty(day, 'pickup', 'sure')}>For Sure</button>
                                <button type="button" className={pickup.certainty === 'maybe' ? 'chip active yellow' : 'chip'} onClick={() => setRideCertainty(day, 'pickup', 'maybe')}>Maybe</button>
                              </div>
                              <div className="time-list">
                                {schedule.pickupTimes.map((time) => (
                                  <label key={time} className="time-option">
                                    <input type="checkbox" checked={pickup.times.includes(time)} onChange={() => toggleTimeSelection(day, 'pickup', time)} />
                                    {time}
                                  </label>
                                ))}
                              </div>
                              <button type="button" className="text-button" onClick={() => removeAvailability(day, 'pickup')}>Remove</button>
                            </div>
                          )}
                          {drop?.selected && (
                            <div className="ride-config">
                              <div className="certainty-row">
                                <button type="button" className={drop.certainty === 'sure' ? 'chip active green' : 'chip'} onClick={() => setRideCertainty(day, 'dropoff', 'sure')}>For Sure</button>
                                <button type="button" className={drop.certainty === 'maybe' ? 'chip active yellow' : 'chip'} onClick={() => setRideCertainty(day, 'dropoff', 'maybe')}>Maybe</button>
                              </div>
                              <div className="time-list">
                                {schedule.dropoffTimes.map((time) => (
                                  <label key={time} className="time-option">
                                    <input type="checkbox" checked={drop.times.includes(time)} onChange={() => toggleTimeSelection(day, 'dropoff', time)} />
                                    {time}
                                  </label>
                                ))}
                              </div>
                              <button type="button" className="text-button" onClick={() => removeAvailability(day, 'dropoff')}>Remove</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className="insights-grid">
                  <div className="panel">
                    <div className="panel-header">Availability overview</div>
                    <div className="people-overview">
                      {schedule.participants.map((person) => (
                        <div key={person.name} className="person-row">
                          <div className="person-name">{person.name}</div>
                          <div className="person-days">
                            {DAYS.slice(0, 5).map((day) => {
                              const pickup = person.availability[day].pickup
                              const drop = person.availability[day].dropoff
                              return (
                                <span key={`${person.name}-${day}`} className={`status-pill ${pickup.selected ? (pickup.certainty === 'sure' ? 'green' : 'yellow') : ''}`}>
                                  {pickup.selected ? '✓' : '—'}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">Carpool balance</div>
                    <div className="balance-list">
                      {participantBalance.map((entry) => (
                        <div key={entry.name} className="balance-item">
                          <span>{entry.name}</span>
                          <strong>{entry.rides}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'people' && (
              <section className="panel full-panel">
                <div className="panel-header">People</div>
                <div className="people-list">
                  {schedule.participants.map((person) => (
                    <button type="button" key={person.name} className={selectedPerson === person.name ? 'person-card active' : 'person-card'} onClick={() => setSelectedPerson(person.name)}>
                      <div>
                        <strong>{person.name}</strong>
                        <span>{generatedSchedule.filter((entry) => entry.person === person.name).length} rides</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'share' && (
              <section className="panel full-panel">
                <div className="panel-header">Invite people to this schedule</div>
                <p className="share-link">PULLUP / join / {schedule.code}</p>
                <div className="share-actions">
                  <button type="button" className="primary-button" onClick={() => navigator.clipboard?.writeText(`PULLUP / join / ${schedule.code}`)}>Copy Link</button>
                  <button type="button" className="secondary-button">View Only Link</button>
                </div>
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="panel full-panel">
                <div className="panel-header">Settings</div>
                <ul className="settings-list">
                  <li>Schedule name</li>
                  <li>Manage days</li>
                  <li>Manage pickup times</li>
                  <li>Manage drop-off times</li>
                  <li>Manage participants</li>
                  <li>Leave schedule</li>
                  <li>Delete schedule</li>
                </ul>
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

export default App
