import { useCallback, useEffect, useRef, useState } from 'react'
import { getStore, getStoreFor, isLocalMode } from './net/store.js'
import {
  makeRoomCode, newRoom, startPlayingPatch, wordCountOf, perPlayerCount,
  membersOf, sideReady, openSeats, TEAM_SIZE, TEAM_LABELS
} from './game.js'
import Home from './screens/Home.jsx'
import Profile from './screens/Profile.jsx'
import Words from './screens/Words.jsx'
import Lobby from './screens/Lobby.jsx'
import Game from './screens/Game.jsx'
import Curtain from './screens/Curtain.jsx'
import ThemePicker from './screens/ThemePicker.jsx'
import Setup from './screens/Setup.jsx'
import PlayerCount from './screens/PlayerCount.jsx'
import TeamPick from './screens/TeamPick.jsx'
import { BOT_LEVELS, botWords } from './bot.js'
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

  // Host is the referee: flips the room to 'playing' once both sides are ready.
  // In team mode only the host's first seat referees — startPlayingPatch picks a
  // random opening side, so two writers would race to different coin flips.
  useEffect(() => {
    if (!room || !session || session.role !== 'host' || (session.seat || 0) !== 0) return
    if (room.status !== 'lobby') {
      startingRef.current = false
      return
    }
    if (sideReady(room, 'host') && sideReady(room, 'guest') && !startingRef.current) {
      startingRef.current = true
      getStoreFor(session).then((store) =>
        store.update(session.code, startPlayingPatch(room))
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
      if (session.hotseat || session.bot) {
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
  const startCreate = () => setFlow({ mode: 'create', step: 'size' })
  const startHotseat = () => setFlow({ mode: 'hotseat', step: 'size' })
  const startPractice = () => setFlow({ mode: 'practice', step: 'profile' })

  // 2 players or 2v2. Hotseat needs it first so it knows how many profiles to
  // collect; online creators answer it here too so Setup can size the boards.
  const onSizeDone = (teamMode) =>
    setFlow({
      ...flow,
      teamMode,
      roster: [],
      step: flow.mode === 'hotseat' ? 'players' : 'profile'
    })

  const hotseatSeats = (teamMode) => (teamMode ? 2 * TEAM_SIZE : 2)
  const HOTSEAT_LABELS = {
    solo: ['Player 1', 'Player 2'],
    team: ['Team One · Player 1', 'Team One · Player 2', 'Team Two · Player 1', 'Team Two · Player 2']
  }

  const onPracticeStart = async (level) => {
    const code = makeRoomCode()
    const bot = BOT_LEVELS[level]
    const r = newRoom(code, { name: profile.name, avatar: profile.avatar }, null, { pace: 'async' })
    r.players.host.ready = false
    r.players.guest = { name: bot.name, avatar: bot.avatar, words: botWords(5), ready: true }
    const s = await getStoreFor({ bot: level })
    await s.createRoom(code, r)
    enterSession(code, 'host', { bot: level })
  }

  const startJoin = async (code) => {
    setError(null)
    const store = await getStore()
    const r = await store.getRoom(code)
    if (!r) return setError(`Room ${code} not found${isLocalMode ? ' (local mode: rooms only exist in this browser)' : ''}`)
    if (r.status !== 'lobby') return setError(`Room ${code} already started`)
    if (!openSeats(r).length) return setError(`Room ${code} is already full`)
    setFlow({ mode: 'join', code, step: 'profile', teamMode: !!r.teamMode })
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
      // Everyone around the phone introduces themselves, one after another.
      const roster = [...(flow.roster || []), p]
      if (roster.length === 1) saveProfile(p) // player 1 is the device owner
      const done = roster.length >= hotseatSeats(flow.teamMode)
      setFlow({ ...flow, roster, step: done ? 'theme' : 'players' })
      return
    }
    saveProfile(p)
    if (flow.mode === 'practice') {
      setFlow({ ...flow, step: 'difficulty' })
      return
    }
    if (flow.mode === 'create') {
      // Theme comes next; the room is created after that.
      setFlow({ ...flow, step: 'theme', p1: p })
      return
    }
    if (flow.teamMode) {
      // 2v2: choose which of the four seats to take.
      setFlow({ ...flow, step: 'team', me: p })
      return
    }
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

  // Two joiners can tap the same empty seat; re-read before writing so the
  // loser of that race gets sent back to the seat map instead of overwriting.
  const [seatError, setSeatError] = useState(null)
  const onTeamPick = async ({ team, seat }) => {
    const store = await getStore()
    const r = await store.getRoom(flow.code)
    if (!r) {
      setFlow(null)
      setError('That room is gone — ask for a new code')
      return
    }
    if (membersOf(r, team)[seat]) {
      setSeatError('Someone just grabbed that seat — pick another')
      return
    }
    setSeatError(null)
    await store.update(flow.code, {
      [`members/${team}/${seat}`]: { name: flow.me.name, avatar: flow.me.avatar, ready: false }
    })
    enterSession(flow.code, team, { seat })
  }

  const onThemeDone = (themeId) => {
    setFlow({ ...flow, step: 'setup', theme: themeId })
  }

  const onSetupDone = async (opts) => {
    if (flow.mode === 'hotseat') {
      const code = makeRoomCode()
      const seat = (p) => ({ name: p.name, avatar: p.avatar, words: null, ready: false })
      const r = newRoom(code, seat(flow.roster[0]), null, { ...opts, pace: 'live' })
      r.theme = flow.theme
      if (opts.teamMode) {
        // Roster order is team one, then team two.
        r.members = {
          host: [seat(flow.roster[0]), seat(flow.roster[1])],
          guest: [seat(flow.roster[2]), seat(flow.roster[3])]
        }
      } else {
        r.players.host.ready = false
        r.players.guest = seat(flow.roster[1])
      }
      const s = await getStoreFor({ hotseat: true })
      await s.createRoom(code, r)
      enterSession(code, 'host', { hotseat: true })
    } else {
      // Online create: room exists now; words come after the guest joins.
      const code = makeRoomCode()
      const store = await getStore()
      const r = newRoom(code, { name: flow.p1.name, avatar: flow.p1.avatar }, null, opts)
      r.theme = flow.theme
      await store.createRoom(code, r)
      enterSession(code, 'host')
    }
  }

  const onRoomWordsDone = async (words) => {
    const s = await getStoreFor(session)
    if (room.teamMode) {
      // Hotseat walks the seats in order; online each device fills its own.
      const t = session.hotseat ? nextPicker(room) : { team: session.role, seat: session.seat || 0 }
      if (!t) return
      await s.update(session.code, {
        [`members/${t.team}/${t.seat}/words`]: words,
        [`members/${t.team}/${t.seat}/ready`]: true
      })
      return
    }
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
      if (room.teamMode) {
        screen = teamLobbyScreen({ room, session, onRoomWordsDone, leaveRoom })
      } else if (session.hotseat) {
        const { host, guest } = room.players
        if (!host.words) {
          screen = (
            <GatedWords
              key="p1"
              avatar={host.avatar}
              name={host.name}
              hint="Pick your 5 secret words — no peeking behind you!"
              title={`${host.name}, pick your ${wordCountOf(room)} words`}
              count={wordCountOf(room)}
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
              title={`${guest.name}, pick your ${wordCountOf(room)} words`}
              count={wordCountOf(room)}
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
          screen = <Words title={`Pick your ${wordCountOf(room)} words`} count={wordCountOf(room)} onDone={onRoomWordsDone} onBack={leaveRoom} />
        }
      }
    } else {
      screen = <Game room={room} role={session.role} seat={session.seat || 0} store={store} hotseat={!!session.hotseat} bot={session.bot || null} onLeave={leaveRoom} />
    }
  } else if (flow?.step === 'difficulty') {
    screen = (
      <div className="screen setup-screen">
        <h2>🤖 Pick your opponent</h2>
        <p className="hint">Practice against the machine — perfect for learning the ropes.</p>
        <div className="home-actions">
          {Object.entries(BOT_LEVELS).map(([level, b]) => (
            <button key={level} className="btn ghost big" onClick={() => onPracticeStart(level)}>
              {b.avatar} {b.name}
              <span className="btn-sub">{level === 'easy' ? 'takes it easy on you' : level === 'medium' ? 'puts up a fight' : 'shows no mercy'}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setFlow(null)}>Back</button>
      </div>
    )
  } else if (flow?.step === 'setup') {
    screen = (
      <Setup
        allowAsync={flow.mode !== 'hotseat'}
        teamMode={!!flow.teamMode}
        onDone={onSetupDone}
        onBack={() => setFlow({ ...flow, step: 'theme' })}
      />
    )
  } else if (flow?.step === 'theme') {
    screen = (
      <ThemePicker
        onDone={onThemeDone}
        onBack={() =>
          setFlow(
            flow.mode === 'hotseat'
              ? { ...flow, step: 'players', roster: flow.roster.slice(0, -1) }
              : { ...flow, step: 'profile' }
          )
        }
      />
    )
  } else if (flow?.step === 'size') {
    screen = <PlayerCount hotseat={flow.mode === 'hotseat'} onDone={onSizeDone} onBack={() => setFlow(null)} />
  } else if (flow?.step === 'players') {
    const taken = flow.roster?.length || 0
    const labels = HOTSEAT_LABELS[flow.teamMode ? 'team' : 'solo']
    screen = (
      <Profile
        key={taken}
        title={`${labels[taken]}, who are you?`}
        initial={taken === 0 ? profile : null}
        onDone={onProfileDone}
        onBack={() =>
          taken === 0
            ? setFlow({ ...flow, step: 'size' })
            : setFlow({ ...flow, roster: flow.roster.slice(0, -1) })
        }
      />
    )
  } else if (flow?.step === 'team') {
    screen = (
      <TeamPick
        code={flow.code}
        error={seatError}
        onPick={onTeamPick}
        onBack={() => { setSeatError(null); setFlow({ ...flow, step: 'profile' }) }}
      />
    )
  } else if (flow?.step === 'profile') {
    screen = (
      <Profile
        initial={profile}
        onDone={onProfileDone}
        onBack={() => setFlow(flow.mode === 'create' ? { ...flow, step: 'size' } : null)}
      />
    )
  } else {
    screen = <Home onCreate={startCreate} onJoin={startJoin} onHotseat={startHotseat} onPractice={startPractice} error={error} />
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

// Seats pick words in a fixed order: team one, then team two.
function nextPicker(room) {
  for (const team of ['host', 'guest']) {
    for (let seat = 0; seat < TEAM_SIZE; seat++) {
      if (!membersOf(room, team)[seat]?.words) return { team, seat }
    }
  }
  return null
}

// Lobby stage of a 2v2 room: hand the phone round (hotseat) or wait for the
// four seats to fill, then take this device's own word picks.
function teamLobbyScreen({ room, session, onRoomWordsDone, leaveRoom }) {
  const n = perPlayerCount(room)
  if (session.hotseat) {
    const t = nextPicker(room)
    if (!t) return <div className="center-page"><div className="spinner" /></div>
    const p = membersOf(room, t.team)[t.seat]
    const mate = membersOf(room, t.team)[1 - t.seat]
    return (
      <GatedWords
        key={`${t.team}-${t.seat}`}
        avatar={p.avatar}
        name={p.name}
        hint={`You're with ${mate?.name || 'your partner'} on ${TEAM_LABELS[t.team]}. Pick ${n} words — the other team mustn't see.`}
        title={`${p.name}, pick your ${n} words`}
        count={n}
        onDone={onRoomWordsDone}
        onBack={leaveRoom}
      />
    )
  }
  const seat = session.seat || 0
  const mine = membersOf(room, session.role)[seat]
  if (openSeats(room).length || mine?.words) {
    return <Lobby room={room} role={session.role} seat={seat} onLeave={leaveRoom} />
  }
  return <Words title={`Pick your ${n} words`} count={n} onDone={onRoomWordsDone} onBack={leaveRoom} />
}

// Curtain first, then the word picker — keeps player 2's screen private.
function GatedWords({ avatar, name, hint, ...wordsProps }) {
  const [ready, setReady] = useState(false)
  if (!ready) return <Curtain avatar={avatar} name={name} hint={hint} onReady={() => setReady(true)} />
  return <Words {...wordsProps} />
}
