import { useCallback, useEffect, useRef, useState } from 'react'
import { getStore, getStoreFor, isLocalMode } from './net/store.js'
import { makeRoomCode, newRoom, startPlayingPatch } from './game.js'
import Home from './screens/Home.jsx'
import Profile from './screens/Profile.jsx'
import Words from './screens/Words.jsx'
import Lobby from './screens/Lobby.jsx'
import Game from './screens/Game.jsx'
import Curtain from './screens/Curtain.jsx'
import ThemePicker from './screens/ThemePicker.jsx'
import { hardRefresh, useUpdateCheck } from './appUpdates.js'
import { applyTheme } from './themes.js'

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
  const latestVersion = useUpdateCheck()
  const [profile, setProfile] = useState(() => load(PROFILE_KEY))
  const [session, setSession] = useState(() => load(SESSION_KEY, sessionStorage)) // {code, role, hotseat?}
  const [room, setRoom] = useState(null)
  const [store, setStore] = useState(null) // resolved backend for the active session
  const [flow, setFlow] = useState(null) // pre-room: {mode:'create'|'join'|'hotseat', code?, p1?}
  const [error, setError] = useState(null)
  const startingRef = useRef(false)

  // Subscribe to the active room.
  useEffect(() => {
    if (!session) {
      setRoom(null)
      setStore(null)
      return
    }
    let unsub = () => {}
    let cancelled = false
    getStoreFor(session).then((store) => {
      if (cancelled) return
      setStore(store)
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

  // Recolor the app to the room's theme; restore defaults outside a room.
  useEffect(() => {
    if (room) applyTheme(room.theme)
    else if (!flow) applyTheme(null)
  }, [room, flow])

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
      getStoreFor(session).then((store) =>
        store.update(session.code, startPlayingPatch())
      )
    }
  }, [room, session])

  const saveProfile = useCallback((p) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    setProfile(p)
  }, [])

  const enterSession = useCallback((code, role, extra) => {
    const s = { code, role, ...extra }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
    setFlow(null)
  }, [])

  const leaveRoom = useCallback(async () => {
    if (session && room) {
      const store = await getStoreFor(session)
      if (session.hotseat) {
        store.deleteRoom(session.code)
      } else if (room.status !== 'finished') {
        store.update(session.code, { [`left/${session.role}`]: true })
      }
    }
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setRoom(null)
    setFlow(null)
  }, [session, room])

  // ── Pre-room flow ─────────────────────────────────────────────
  const startCreate = () => setFlow({ mode: 'create', step: 'profile' })
  const startHotseat = () => setFlow({ mode: 'hotseat', step: 'profile1' })

  const startJoin = async (code) => {
    setError(null)
    const store = await getStore()
    const r = await store.getRoom(code)
    if (!r) return setError(`Room ${code} not found${isLocalMode ? ' (local mode: rooms only exist in this browser)' : ''}`)
    if (r.players.guest) return setError(`Room ${code} is already full`)
    if (r.status !== 'lobby') return setError(`Room ${code} already started`)
    setFlow({ mode: 'join', code, step: 'profile' })
  }

  // Opened via a scanned room QR (…?join=CODE): jump into the join flow.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('join')
    if (!code) return
    // Strip the param so a refresh doesn't re-trigger the join.
    window.history.replaceState(null, '', window.location.pathname)
    if (!session) startJoin(code.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onProfileDone = async (p) => {
    if (flow.mode === 'hotseat') {
      if (flow.step === 'profile1') {
        saveProfile(p) // player 1 is the device owner
        setFlow({ ...flow, step: 'profile2', p1: p })
      } else {
        // Both players known — the host picks the room's theme next.
        setFlow({ ...flow, step: 'theme', p2: p })
      }
      return
    }
    saveProfile(p)
    if (flow.mode === 'create') {
      // Theme comes next; the room is created after that.
      setFlow({ ...flow, step: 'theme', p1: p })
      return
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

  const onThemeDone = async (themeId) => {
    if (flow.mode === 'hotseat') {
      const code = makeRoomCode()
      const r = newRoom(code, { name: flow.p1.name, avatar: flow.p1.avatar }, null)
      r.theme = themeId
      r.players.host.ready = false
      r.players.guest = { name: flow.p2.name, avatar: flow.p2.avatar, words: null, ready: false }
      const s = await getStoreFor({ hotseat: true })
      await s.createRoom(code, r)
      enterSession(code, 'host', { hotseat: true })
    } else {
      // Online create: room exists now; words come after the guest joins.
      const code = makeRoomCode()
      const store = await getStore()
      const r = newRoom(code, { name: flow.p1.name, avatar: flow.p1.avatar }, null)
      r.theme = themeId
      await store.createRoom(code, r)
      enterSession(code, 'host')
    }
  }

  const onRoomWordsDone = async (words) => {
    const s = await getStoreFor(session)
    // Hotseat: fill the host slot first, then the guest slot.
    const target = session.hotseat
      ? (room.players.host.words ? 'guest' : 'host')
      : session.role
    await s.update(session.code, {
      [`players/${target}/words`]: words,
      [`players/${target}/ready`]: true
    })
  }

  // ── Screen selection ──────────────────────────────────────────
  let screen
  if (session) {
    if (!room || !store) {
      screen = <div className="center-page"><div className="spinner" /></div>
    } else if (room.status === 'lobby') {
      if (session.hotseat) {
        const { host, guest } = room.players
        if (!host.words) {
          screen = (
            <GatedWords
              key="p1"
              avatar={host.avatar}
              name={host.name}
              hint="Pick your 5 secret words — no peeking behind you!"
              title={`${host.name}, pick your 5 words`}
              onDone={onRoomWordsDone}
              onBack={leaveRoom}
            />
          )
        } else if (!guest.words) {
          screen = (
            <GatedWords
              key="p2"
              avatar={guest.avatar}
              name={guest.name}
              hint={`${host.name} has locked in. Your turn to pick — no peeking behind you!`}
              title={`${guest.name}, pick your 5 words`}
              onDone={onRoomWordsDone}
              onBack={leaveRoom}
            />
          )
        } else {
          screen = <div className="center-page"><div className="spinner" /></div>
        }
      } else {
        const me = room.players[session.role]
        const guest = room.players.guest
        if (me?.words) {
          screen = <Lobby room={room} role={session.role} onLeave={leaveRoom} />
        } else if (session.role === 'host' && !guest) {
          // Host waiting for guest to arrive before picking words.
          screen = <Lobby room={room} role={session.role} onLeave={leaveRoom} />
        } else {
          screen = <Words title="Pick your 5 words" onDone={onRoomWordsDone} onBack={leaveRoom} />
        }
      }
    } else {
      screen = <Game room={room} role={session.role} store={store} hotseat={!!session.hotseat} onLeave={leaveRoom} />
    }
  } else if (flow?.step === 'theme') {
    screen = (
      <ThemePicker
        onDone={onThemeDone}
        onBack={() => setFlow({ ...flow, step: flow.mode === 'hotseat' ? 'profile2' : 'profile' })}
      />
    )
  } else if (flow?.step === 'profile') {
    screen = <Profile initial={profile} onDone={onProfileDone} onBack={() => setFlow(null)} />
  } else if (flow?.step === 'profile1') {
    screen = <Profile title="Player 1, who are you?" initial={profile} onDone={onProfileDone} onBack={() => setFlow(null)} />
  } else if (flow?.step === 'profile2') {
    screen = <Profile key="p2" title="Player 2, who are you?" initial={null} onDone={onProfileDone} onBack={() => setFlow({ ...flow, step: 'profile1' })} />
  } else {
    screen = <Home onCreate={startCreate} onJoin={startJoin} onHotseat={startHotseat} error={error} />
  }

  return (
    <div className="app">
      {isLocalMode && <div className="local-badge">Local demo — online rooms sync between tabs of this browser</div>}
      {screen}
      {latestVersion && (
        <div className="modal-overlay update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
          <div className="modal-card update-card">
            <div className="update-icon">↻</div>
            <h2 id="update-title">WordStrike update available</h2>
            <p>A newer version of WordStrike is ready. Refresh now to get the latest version.</p>
            <button className="btn primary big" onClick={hardRefresh}>Refresh</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Curtain first, then the word picker — keeps player 2's screen private.
function GatedWords({ avatar, name, hint, ...wordsProps }) {
  const [ready, setReady] = useState(false)
  if (!ready) return <Curtain avatar={avatar} name={name} hint={hint} onReady={() => setReady(true)} />
  return <Words {...wordsProps} />
}
