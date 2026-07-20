import { useCallback, useEffect, useRef, useState } from 'react'
import { getStore, isLocalMode } from './net/store.js'
import { makeRoomCode, newRoom } from './game.js'
import Home from './screens/Home.jsx'
import Profile from './screens/Profile.jsx'
import Words from './screens/Words.jsx'
import Lobby from './screens/Lobby.jsx'
import Game from './screens/Game.jsx'

const PROFILE_KEY = 'ws-profile'
const SESSION_KEY = 'ws-session'

// The active-room session lives in sessionStorage (per-tab) so two tabs of
// the same browser can hold different seats in local demo mode; it still
// survives a refresh of that tab.
function load(key, storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(key))
  } catch {
    return null
  }
}

export default function App() {
  const [profile, setProfile] = useState(() => load(PROFILE_KEY))
  const [session, setSession] = useState(() => load(SESSION_KEY, sessionStorage)) // {code, role}
  const [room, setRoom] = useState(null)
  const [flow, setFlow] = useState(null) // pre-room: {mode:'create'|'join', code?}
  const [error, setError] = useState(null)
  const startingRef = useRef(false)

  // Subscribe to the active room.
  useEffect(() => {
    if (!session) {
      setRoom(null)
      return
    }
    let unsub = () => {}
    let cancelled = false
    getStore().then((store) => {
      if (cancelled) return
      unsub = store.subscribe(session.code, (r) => {
        if (r === null) {
          // Room vanished (or never existed after a stale refresh).
          sessionStorage.removeItem(SESSION_KEY)
          setSession(null)
        }
        setRoom(r)
      })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [session])

  // Host is the referee: flips the room to 'playing' once both players are ready.
  useEffect(() => {
    if (!room || !session || session.role !== 'host') return
    if (room.status !== 'lobby') {
      startingRef.current = false
      return
    }
    const { host, guest } = room.players
    if (host?.ready && guest?.ready && !startingRef.current) {
      startingRef.current = true
      getStore().then((store) =>
        store.update(session.code, {
          status: 'playing',
          turn: Math.random() < 0.5 ? 'host' : 'guest',
          lastMove: null
        })
      )
    }
  }, [room, session])

  const saveProfile = useCallback((p) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    setProfile(p)
  }, [])

  const enterSession = useCallback((code, role) => {
    const s = { code, role }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
    setFlow(null)
  }, [])

  const leaveRoom = useCallback(async () => {
    if (session && room && room.status !== 'finished') {
      const store = await getStore()
      store.update(session.code, { [`left/${session.role}`]: true })
    }
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setRoom(null)
    setFlow(null)
  }, [session, room])

  // ── Pre-room flow ─────────────────────────────────────────────
  const startCreate = () => setFlow({ mode: 'create', step: 'profile' })

  const startJoin = async (code) => {
    setError(null)
    const store = await getStore()
    const r = await store.getRoom(code)
    if (!r) return setError(`Room ${code} not found${isLocalMode ? ' (local mode: rooms only exist in this browser)' : ''}`)
    if (r.players.guest) return setError(`Room ${code} is already full`)
    if (r.status !== 'lobby') return setError(`Room ${code} already started`)
    setFlow({ mode: 'join', code, step: 'profile' })
  }

  const onProfileDone = async (p) => {
    saveProfile(p)
    if (flow.mode === 'create') {
      setFlow({ ...flow, step: 'words' })
    } else {
      // Claim the guest seat now so the room reads as full.
      const store = await getStore()
      const r = await store.getRoom(flow.code)
      if (!r || r.players.guest) {
        setFlow(null)
        setError('Someone else grabbed that seat — ask for a new room code')
        return
      }
      await store.update(flow.code, {
        'players/guest': { name: p.name, avatar: p.avatar, words: null, ready: false }
      })
      enterSession(flow.code, 'guest')
    }
  }

  const onHostWordsDone = async (words) => {
    const store = await getStore()
    const code = makeRoomCode()
    await store.createRoom(code, newRoom(code, { name: profile.name, avatar: profile.avatar }, words))
    enterSession(code, 'host')
  }

  const onRoomWordsDone = async (words) => {
    const store = await getStore()
    await store.update(session.code, {
      [`players/${session.role}/words`]: words,
      [`players/${session.role}/ready`]: true
    })
  }

  // ── Screen selection ──────────────────────────────────────────
  let screen
  if (session) {
    if (!room) {
      screen = <div className="center-page"><div className="spinner" /></div>
    } else if (room.status === 'lobby') {
      const me = room.players[session.role]
      screen = me?.words ? (
        <Lobby room={room} role={session.role} onLeave={leaveRoom} />
      ) : (
        <Words title="Pick your 5 words" onDone={onRoomWordsDone} onBack={leaveRoom} />
      )
    } else {
      screen = <Game room={room} role={session.role} onLeave={leaveRoom} />
    }
  } else if (flow?.step === 'profile') {
    screen = <Profile initial={profile} onDone={onProfileDone} onBack={() => setFlow(null)} />
  } else if (flow?.step === 'words') {
    screen = <Words title="Pick your 5 words" onDone={onHostWordsDone} onBack={() => setFlow({ ...flow, step: 'profile' })} />
  } else {
    screen = <Home onCreate={startCreate} onJoin={startJoin} error={error} />
  }

  return (
    <div className="app">
      {isLocalMode && <div className="local-badge">Local demo — rooms sync between tabs of this browser</div>}
      {screen}
    </div>
  )
}
