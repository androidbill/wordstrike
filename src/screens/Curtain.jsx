// Full-screen opaque handoff screen for pass-and-play: hides the board
// while the device changes hands.
export default function Curtain({ avatar, name, hint, onReady }) {
  return (
    <div className="curtain">
      <div className="curtain-inner">
        <span className="curtain-avatar">{avatar}</span>
        <h2>Hand the phone to {name}</h2>
        {hint && <p className="hint">{hint}</p>}
        <button className="btn primary big" onClick={onReady}>
          I'm {name} — let's go
        </button>
      </div>
    </div>
  )
}
