// First fork in the create/pass-and-play flows: duel or doubles. Hotseat needs
// the answer up front because it decides how many profiles to collect.
export default function PlayerCount({ hotseat, onDone, onBack }) {
  return (
    <div className="screen setup-screen">
      <h2>How many players?</h2>
      <p className="hint">
        {hotseat
          ? 'Everyone shares this one device — a curtain keeps each turn secret.'
          : 'Everyone plays on their own phone using the same room code.'}
      </p>

      <div className="home-actions">
        <button className="btn ghost big" onClick={() => onDone(false)}>
          ⚔️ 2 players
          <span className="btn-sub">classic head-to-head duel</span>
        </button>
        <button className="btn ghost big" onClick={() => onDone(true)}>
          👥 4 players — 2 vs 2
          <span className="btn-sub">team up, share a board, take turns</span>
        </button>
      </div>

      <details className="rules">
        <summary>How teams work</summary>
        <ul>
          <li>Each player secretly picks their own words — your team's board is both sets combined.</li>
          <li>Turns rotate <strong>you → rival → your partner → their partner</strong>, so nobody sits out.</li>
          <li>Letters, hits and solves are shared: whatever your partner uncovers is on the board for you.</li>
          <li>One power-up and one pause budget per team — decide together when to spend them.</li>
          <li>First team to crack every word on the rival board wins it for both of you.</li>
        </ul>
      </details>

      <button className="btn ghost" onClick={onBack}>Back</button>
    </div>
  )
}
